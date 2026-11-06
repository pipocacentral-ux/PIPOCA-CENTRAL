import { getDb, getAdminAuth, FieldValue, verifyRequest, serializeValue } from "../lib/admin.js";
import { HttpError, readBody, sendJson, cleanText, isEmail } from "../lib/http.js";
import { sendMail } from "../lib/mail.js";

const SUPER_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "canalpedroid@gmail.com").trim().toLowerCase();

async function adminRecord(db, uid) {
  const snap = await db.collection("adminUsers").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function requireAdmin(req) {
  const token = await verifyRequest(req);
  if (!token) throw new HttpError(401, "Faça login no painel", "unauthenticated");
  const db = getDb();
  const record = token.admin === true ? await adminRecord(db, token.uid) : null;
  if (!record) throw new HttpError(403, "Sem permissão de administrador", "forbidden");
  return { token, db, isSuper: token.superAdmin === true && record.role === "super" };
}

async function requireSuper(req) {
  const ctx = await requireAdmin(req);
  if (!ctx.isSuper) throw new HttpError(403, "Só o administrador geral pode fazer isso", "forbidden");
  return ctx;
}

async function grant(db, auth, user, role, addedBy) {
  const claims = role === "super" ? { admin: true, superAdmin: true } : { admin: true };
  await auth.setCustomUserClaims(user.uid, claims);
  await db.collection("adminUsers").doc(user.uid).set({
    email: String(user.email || "").toLowerCase(),
    displayName: user.displayName || "",
    role,
    addedBy: addedBy || "sistema",
    addedAt: FieldValue.serverTimestamp(),
  });
}

async function bootstrap(req) {
  const token = await verifyRequest(req);
  if (!token) throw new HttpError(401, "Faça login no painel", "unauthenticated");
  const db = getDb();
  const auth = getAdminAuth();
  const email = String(token.email || "").toLowerCase();
  const verified = token.email_verified === true;

  if (verified && email === SUPER_EMAIL) {
    const record = await adminRecord(db, token.uid);
    const hasClaims = token.admin === true && token.superAdmin === true;
    if (!record || record.role !== "super" || !hasClaims) {
      const user = await auth.getUser(token.uid);
      await grant(db, auth, user, "super", "sistema");
      return { ok: true, role: "super", refresh: true };
    }
    return { ok: true, role: "super", refresh: false };
  }

  if (token.admin === true) {
    const record = await adminRecord(db, token.uid);
    if (record) return { ok: true, role: record.role === "super" && token.superAdmin === true ? "super" : "admin", refresh: false };
    return { ok: true, role: null, refresh: true };
  }

  if (verified && email) {
    const inviteRef = db.collection("adminInvites").doc(email);
    const invite = await inviteRef.get();
    if (invite.exists) {
      const user = await auth.getUser(token.uid);
      await grant(db, auth, user, "admin", invite.data().invitedBy || "convite");
      await inviteRef.delete();
      return { ok: true, role: "admin", refresh: true };
    }
  }
  return { ok: true, role: null, refresh: false };
}

async function listAdmins(req) {
  const { db } = await requireAdmin(req);
  const [admins, invites] = await Promise.all([db.collection("adminUsers").get(), db.collection("adminInvites").get()]);
  return {
    ok: true,
    admins: admins.docs.map((d) => ({ uid: d.id, ...serializeValue(d.data()) })),
    invites: invites.docs.map((d) => ({ email: d.id, ...serializeValue(d.data()) })),
  };
}

async function addAdmin(req, body) {
  const { token, db } = await requireSuper(req);
  const auth = getAdminAuth();
  const email = cleanText(body.email, 200).toLowerCase();
  if (!isEmail(email)) throw new HttpError(400, "Digite um e-mail válido", "bad-email");
  if (email === SUPER_EMAIL) throw new HttpError(400, "Esse e-mail já é o do administrador geral", "already-super");

  let user = null;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }

  const panelUrl = process.env.PANEL_URL || "";
  if (user && user.emailVerified) {
    const existing = await adminRecord(db, user.uid);
    if (existing) throw new HttpError(409, "Essa pessoa já é administradora", "already-admin");
    await grant(db, auth, user, "admin", token.email || token.uid);
    const mail = await sendMail("admin_invite", { to: email, panelUrl });
    return { ok: true, status: "granted", mailSent: mail.ok, mailError: mail.ok ? null : mail.error };
  }

  await db.collection("adminInvites").doc(email).set({
    email,
    invitedBy: token.email || token.uid,
    invitedAt: FieldValue.serverTimestamp(),
  });
  const mail = await sendMail("admin_invite", { to: email, panelUrl });
  return { ok: true, status: "invited", mailSent: mail.ok, mailError: mail.ok ? null : mail.error };
}

async function cancelInvite(req, body) {
  const { db } = await requireSuper(req);
  const email = cleanText(body.email, 200).toLowerCase();
  if (!email) throw new HttpError(400, "Convite inválido", "bad-email");
  await db.collection("adminInvites").doc(email).delete();
  return { ok: true };
}

async function removeAdmin(req, body) {
  const { token, db } = await requireSuper(req);
  const uid = String(body.uid || "");
  if (!uid) throw new HttpError(400, "Administrador inválido", "bad-uid");
  if (uid === token.uid) throw new HttpError(400, "Você não pode remover a si mesmo", "self");
  const record = await adminRecord(db, uid);
  if (!record) throw new HttpError(404, "Administrador não encontrado", "not-found");
  if (record.role === "super") throw new HttpError(400, "O administrador geral não pode ser removido", "super");
  const auth = getAdminAuth();
  await db.collection("adminUsers").doc(uid).delete();
  await auth.setCustomUserClaims(uid, null);
  await auth.revokeRefreshTokens(uid);
  return { ok: true };
}

async function listUsers(req, body) {
  await requireAdmin(req);
  const page = await getAdminAuth().listUsers(50, body.pageToken || undefined);
  return {
    ok: true,
    nextPageToken: page.pageToken || null,
    users: page.users.map((u) => ({
      uid: u.uid,
      email: u.email || "",
      displayName: u.displayName || "",
      disabled: u.disabled,
      verified: u.emailVerified,
      provider: (u.providerData[0] && u.providerData[0].providerId) || "",
      createdAt: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime,
      isAdmin: Boolean(u.customClaims && u.customClaims.admin),
    })),
  };
}

async function setUserDisabled(req, body) {
  const { token, db } = await requireAdmin(req);
  const uid = String(body.uid || "");
  if (!uid) throw new HttpError(400, "Usuário inválido", "bad-uid");
  if (uid === token.uid) throw new HttpError(400, "Você não pode suspender a si mesmo", "self");
  if (await adminRecord(db, uid)) throw new HttpError(400, "Remova o acesso de administrador antes de suspender essa conta", "is-admin");
  const auth = getAdminAuth();
  const disabled = body.disabled === true;
  await auth.updateUser(uid, { disabled });
  if (disabled) await auth.revokeRefreshTokens(uid);
  return { ok: true, disabled };
}

async function stats(req) {
  const { db } = await requireAdmin(req);
  const count = async (query) => (await query.count().get()).data().count;
  const col = (name) => db.collection(name);
  const [movies, series, people, news, reviews, lists, commentsPending, commentsFlagged, messagesNew, users] = await Promise.all([
    count(col("movies")),
    count(col("series")),
    count(col("people")),
    count(col("news")),
    count(col("reviews")),
    count(col("lists")),
    count(col("comments").where("status", "==", "pending")),
    count(col("comments").where("status", "==", "flagged")),
    count(col("contactMessages").where("status", "==", "new")),
    count(col("users")),
  ]);
  return { ok: true, movies, series, people, news, reviews, lists, commentsPending, commentsFlagged, messagesNew, users };
}

async function replyMessage(req, body) {
  const { token, db } = await requireAdmin(req);
  const id = String(body.id || "");
  const text = cleanText(body.text, 5000);
  if (!id || text.length < 3) throw new HttpError(400, "Escreva a resposta", "empty");
  const ref = db.collection("contactMessages").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Mensagem não encontrada", "not-found");
  const data = snap.data();
  const result = await sendMail("admin_reply", {
    to: data.email,
    name: data.name,
    subject: cleanText(body.subject || `Re: ${data.subject}`, 120),
    text,
  });
  if (!result.ok) {
    throw new HttpError(502, result.error === "mail-not-configured" ? "O envio de e-mail ainda não está configurado (MAIL_WORKER_URL e MAIL_SHARED_SECRET na Vercel)." : `Não foi possível enviar: ${result.error || "erro no envio"}`, "mail-failed");
  }
  await ref.update({ status: "replied", repliedAt: FieldValue.serverTimestamp(), repliedBy: token.email || token.uid, replyText: text });
  return { ok: true };
}

const ACTIONS = { bootstrap, listAdmins, addAdmin, cancelInvite, removeAdmin, listUsers, setUserDisabled, stats, replyMessage };

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Método não permitido" });
  try {
    const body = readBody(req);
    const action = ACTIONS[body.action];
    if (!action) throw new HttpError(400, "Ação desconhecida", "bad-action");
    sendJson(res, 200, await action(req, body));
  } catch (error) {
    if (error instanceof HttpError) return sendJson(res, error.status, { ok: false, error: error.message, code: error.code });
    console.error("admin", error);
    sendJson(res, 500, { ok: false, error: "Erro interno. Tente novamente.", code: "internal" });
  }
}
