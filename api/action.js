import { getDb, getAdminAuth, FieldValue, verifyRequest, serializeValue } from "../lib/admin.js";
import { HttpError, readBody, sendJson, clientIp, cleanText, isEmail } from "../lib/http.js";
import { hit, hashKey } from "../lib/ratelimit.js";
import { sendMail } from "../lib/mail.js";
import { applyRating, collectionFor } from "../lib/ratings.js";
import { needsReview } from "../lib/moderation.js";

const SUBJECTS = ["Sugestão", "Correção de dado no catálogo", "Denúncia de conteúdo", "Parceria", "Outro"];

function parseTarget(body) {
  const type = body.type === "series" ? "series" : body.type === "movie" ? "movie" : null;
  const slug = String(body.slug || "").toLowerCase();
  if (!type || !/^[a-z0-9-]{1,100}$/.test(slug)) throw new HttpError(400, "Título inválido", "bad-target");
  return { type, slug };
}

async function requireUser(req, { verified = false } = {}) {
  const token = await verifyRequest(req);
  if (!token) throw new HttpError(401, "Faça login para continuar", "unauthenticated");
  if (verified && token.email_verified !== true) {
    throw new HttpError(403, "Confirme seu e-mail para usar essa função", "email-not-verified");
  }
  return token;
}

async function ensurePublished(db, type, slug) {
  const snap = await db.collection(collectionFor(type)).doc(slug).get();
  if (!snap.exists || snap.data().status !== "published") throw new HttpError(404, "Título não encontrado", "not-found");
  return snap.data();
}

async function rate(req, body) {
  const token = await requireUser(req, { verified: true });
  const { type, slug } = parseTarget(body);
  const value = Number(body.value);
  if (!Number.isInteger(value) || value < 0 || value > 5) throw new HttpError(400, "Nota inválida", "bad-value");
  const db = getDb();
  const limit = await hit(db, hashKey(["rate", token.uid]), 40, 3600);
  if (!limit.ok) throw new HttpError(429, "Muitas avaliações em pouco tempo. Tente mais tarde.", "rate-limited");
  const result = await applyRating(db, { type, slug, uid: token.uid, value });
  return { ok: true, ...result };
}

async function comment(req, body) {
  const token = await requireUser(req, { verified: true });
  const { type, slug } = parseTarget(body);
  const text = cleanText(body.text, 1500);
  if (text.length < 2) throw new HttpError(400, "Escreva um pouco mais", "too-short");
  const db = getDb();
  await ensurePublished(db, type, slug);
  const short = await hit(db, hashKey(["comment", token.uid]), 5, 600);
  const daily = await hit(db, hashKey(["comment-day", token.uid]), 40, 86400);
  if (!short.ok || !daily.ok) throw new HttpError(429, "Você comentou bastante agora há pouco. Espere um pouco.", "rate-limited");

  const profile = await db.collection("users").doc(token.uid).get();
  const p = profile.exists ? profile.data() : {};
  const displayName = cleanText(p.displayName || token.name || (token.email || "").split("@")[0] || "Usuário", 40);
  const status = needsReview(text) ? "pending" : "visible";
  const ref = await db.collection("comments").add({
    targetKey: `${type}_${slug}`,
    targetType: type,
    targetSlug: slug,
    uid: token.uid,
    displayName,
    avatarUrl: String(p.avatarUrl || token.picture || "").slice(0, 300),
    text,
    status,
    reports: 0,
    reporters: [],
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, id: ref.id, status };
}

async function deleteComment(req, body) {
  const token = await requireUser(req);
  const id = String(body.id || "");
  if (!id) throw new HttpError(400, "Comentário inválido", "bad-id");
  const ref = getDb().collection("comments").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (snap.data().uid !== token.uid && token.admin !== true) throw new HttpError(403, "Sem permissão", "forbidden");
  await ref.delete();
  return { ok: true };
}

async function reportComment(req, body) {
  const token = await requireUser(req);
  const id = String(body.id || "");
  if (!id) throw new HttpError(400, "Comentário inválido", "bad-id");
  const db = getDb();
  const limit = await hit(db, hashKey(["report", token.uid]), 20, 3600);
  if (!limit.ok) throw new HttpError(429, "Muitas denúncias em pouco tempo", "rate-limited");
  const ref = db.collection("comments").doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data();
    if (data.uid === token.uid || (data.reporters || []).includes(token.uid)) return;
    const reports = (Number(data.reports) || 0) + 1;
    const update = { reports, reporters: FieldValue.arrayUnion(token.uid) };
    if (reports >= 3 && data.status === "visible") update.status = "flagged";
    tx.update(ref, update);
  });
  return { ok: true };
}

async function contact(req, body) {
  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 200).toLowerCase();
  const subject = SUBJECTS.includes(body.subject) ? body.subject : "Outro";
  const message = cleanText(body.message, 4000);
  if (body.website) return { ok: true };
  if (Number(body.elapsed) < 2500) throw new HttpError(429, "Envio rápido demais. Tente de novo.", "too-fast");
  if (!name || !isEmail(email) || message.length < 10) throw new HttpError(400, "Preencha nome, e-mail válido e uma mensagem com pelo menos 10 caracteres.", "invalid");

  const db = getDb();
  const ip = clientIp(req);
  const hourly = await hit(db, hashKey(["contact", ip]), 3, 3600);
  const daily = await hit(db, hashKey(["contact-day", ip]), 8, 86400);
  if (!hourly.ok || !daily.ok) throw new HttpError(429, "Você já enviou mensagens demais por hoje. Tente amanhã.", "rate-limited");

  const token = await verifyRequest(req);
  const ref = await db.collection("contactMessages").add({
    name,
    email,
    subject,
    message,
    status: "new",
    uid: token ? token.uid : null,
    ipHash: hashKey(["ip", ip]),
    createdAt: FieldValue.serverTimestamp(),
  });
  await Promise.allSettled([
    sendMail("contact_notify", { name, email, subject, message, id: ref.id }),
    sendMail("contact_confirm", { to: email, name }),
  ]);
  return { ok: true };
}

async function exportData(req) {
  const token = await requireUser(req);
  const db = getDb();
  const userRef = db.collection("users").doc(token.uid);
  const [profile, favorites, watchlist, ratings, comments] = await Promise.all([
    userRef.get(),
    userRef.collection("favorites").get(),
    userRef.collection("watchlist").get(),
    db.collection("ratings").where("uid", "==", token.uid).get(),
    db.collection("comments").where("uid", "==", token.uid).get(),
  ]);
  const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...serializeValue(d.data()) }));
  return {
    ok: true,
    exportedAt: new Date().toISOString(),
    account: { uid: token.uid, email: token.email || null, emailVerified: token.email_verified === true },
    profile: profile.exists ? serializeValue(profile.data()) : null,
    favorites: rows(favorites),
    watchlist: rows(watchlist),
    ratings: rows(ratings),
    comments: rows(comments),
  };
}

async function deleteAccount(req, body) {
  const token = await requireUser(req);
  if (body.confirm !== "EXCLUIR") throw new HttpError(400, "Confirmação ausente", "no-confirm");
  if (token.admin === true) throw new HttpError(403, "Contas de administrador não podem ser excluídas por aqui", "admin-account");
  const db = getDb();
  const ratings = await db.collection("ratings").where("uid", "==", token.uid).get();
  for (const doc of ratings.docs) {
    const r = doc.data();
    await applyRating(db, { type: r.type, slug: r.slug, uid: token.uid, value: 0, tolerateMissing: true });
  }
  const comments = await db.collection("comments").where("uid", "==", token.uid).get();
  for (let i = 0; i < comments.docs.length; i += 400) {
    const batch = db.batch();
    comments.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await db.recursiveDelete(db.collection("users").doc(token.uid));
  await getAdminAuth().deleteUser(token.uid);
  return { ok: true };
}

const ACTIONS = { rate, comment, deleteComment, reportComment, contact, exportData, deleteAccount };

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Método não permitido" });
  try {
    const body = readBody(req);
    const action = ACTIONS[body.action];
    if (!action) throw new HttpError(400, "Ação desconhecida", "bad-action");
    const result = await action(req, body);
    sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      return sendJson(res, error.status, { ok: false, error: error.message, code: error.code });
    }
    console.error("action", error);
    sendJson(res, 500, { ok: false, error: "Erro interno. Tente novamente.", code: "internal" });
  }
}
