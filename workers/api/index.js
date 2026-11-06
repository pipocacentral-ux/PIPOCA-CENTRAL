const DEFAULT_SHEET_ID = "14PvX7iusdgFR7U7m0U6FpklhNsDFZ5AZxmiDiTDZroo";
const DEFAULT_GIDS = { filmes: "0", series: "16873436", plataformas: "1575186231", avatares: "294963624" };
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const DEFAULT_OWNER = "pipocacentral@gmail.com";
const MAX_SHEET_ROWS = 5000;
const GEMINI_LIMITS = { perHour: 20, perDay: 120 };

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || "error";
  }
}

function origins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function corsFor(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function reply(data, status, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

async function sameSecret(a, b) {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

function b64urlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodePart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

let jwksCache = { keys: null, expires: 0 };

async function loadKeys(force = false) {
  const now = Date.now();
  if (!force && jwksCache.keys && jwksCache.expires > now) return jwksCache.keys;
  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new HttpError(503, "Não foi possível validar o login agora", "jwks");
  const data = await response.json();
  const maxAge = Number((response.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys: data.keys || [], expires: now + Math.min(maxAge, 21600) * 1000 };
  return jwksCache.keys;
}

async function verifyIdToken(token, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new HttpError(503, "FIREBASE_PROJECT_ID não configurado no Worker", "config");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new HttpError(401, "Token inválido", "bad-token");
  let header;
  let payload;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    throw new HttpError(401, "Token inválido", "bad-token");
  }
  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "Token inválido", "bad-token");

  let keys = await loadKeys();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await loadKeys(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new HttpError(401, "Token inválido", "bad-token");

  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new HttpError(401, "Token inválido", "bad-token");

  const skew = 60;
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new HttpError(401, "Token de outro projeto", "bad-token");
  if (!payload.sub || typeof payload.sub !== "string") throw new HttpError(401, "Token inválido", "bad-token");
  if (!payload.exp || payload.exp < nowSeconds - skew) throw new HttpError(401, "Sessão expirada. Entre novamente.", "expired");
  if (payload.iat && payload.iat > nowSeconds + skew) throw new HttpError(401, "Token inválido", "bad-token");
  if (payload.auth_time && payload.auth_time > nowSeconds + skew) throw new HttpError(401, "Token inválido", "bad-token");
  return payload;
}

async function requireAdmin(request, env) {
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) throw new HttpError(401, "Faça login no painel", "unauthenticated");
  const payload = await verifyIdToken(bearer, env);
  if (payload.admin !== true) throw new HttpError(403, "Sem permissão de administrador", "forbidden");
  return payload;
}

const memoryHits = new Map();

async function allow(env, key, limit, windowSeconds) {
  if (env.RATE_KV) {
    const raw = await env.RATE_KV.get(key);
    const count = Number(raw || 0);
    if (count >= limit) return false;
    await env.RATE_KV.put(key, String(count + 1), { expirationTtl: Math.max(windowSeconds, 60) });
    return true;
  }
  const now = Date.now();
  const entry = memoryHits.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryHits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function columnLetter(index) {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

async function sheets(request, env, url) {
  await requireAdmin(request, env);
  const tab = decodeURIComponent(url.pathname.replace(/^\/sheets\//, "")).toLowerCase();
  const gid = env[`SHEET_GID_${tab.toUpperCase()}`] || DEFAULT_GIDS[tab];
  if (!gid) throw new HttpError(404, "Aba desconhecida. Use: filmes, series, plataformas ou avatares.", "bad-tab");
  const sheetId = env.SHEETS_ID || DEFAULT_SHEET_ID;
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const response = await fetch(exportUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || type.includes("text/html")) {
    throw new HttpError(502, "Não consegui ler a planilha. Confira se está como “qualquer pessoa com o link pode ver”.", "sheet-private");
  }
  const rows = parseCsv(await response.text());
  const header = rows.shift() || [];
  const clean = rows.filter((r) => r.some((c) => String(c).trim() !== "")).slice(0, MAX_SHEET_ROWS);
  const columns = header.map((name, i) => ({ letter: columnLetter(i), name: String(name).trim() }));
  const preview = url.searchParams.get("preview") === "1";
  return { ok: true, tab, columns, total: clean.length, rows: preview ? clean.slice(0, 5) : clean };
}

function escHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function paragraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function shell(title, inner) {
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#0B0D12;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#F5F5F5">
<div style="max-width:560px;margin:0 auto;background:#1B202B;border-radius:16px;padding:28px">
<div style="font-size:20px;font-weight:800;margin-bottom:18px">🍿 PipocaCentral</div>
<h1 style="font-size:20px;margin:0 0 16px;color:#FFC857">${escHtml(title)}</h1>
<div style="font-size:15px;color:#E4E6EB">${inner}</div>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #2A3040;font-size:12px;color:#A7ADB8">Você recebeu este e-mail porque entrou em contato com o PipocaCentral ou foi convidado para a equipe.</div>
</div></body></html>`;
}

function isEmail(value) {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(value || ""));
}

function buildMail(body, env) {
  const owner = env.OWNER_EMAIL || DEFAULT_OWNER;
  switch (body.type) {
    case "contact_notify": {
      const subject = `[Contato] ${String(body.subject || "Outro").slice(0, 80)} — ${String(body.name || "").slice(0, 80)}`;
      const inner = `<p style="margin:0 0 6px"><strong>Nome:</strong> ${escHtml(body.name)}</p><p style="margin:0 0 6px"><strong>E-mail:</strong> ${escHtml(body.email)}</p><p style="margin:0 0 14px"><strong>Assunto:</strong> ${escHtml(body.subject)}</p>${paragraphs(body.message)}`;
      return { to: owner, subject, html: shell("Nova mensagem pelo site", inner), text: `${body.name} <${body.email}>\n${body.subject}\n\n${body.message}`, replyTo: isEmail(body.email) ? body.email : undefined, restricted: false };
    }
    case "contact_confirm": {
      if (!isEmail(body.to)) throw new HttpError(400, "Destinatário inválido", "bad-recipient");
      const inner = paragraphs(`Oi, ${String(body.name || "").slice(0, 60)}!\n\nRecebemos a sua mensagem e vamos responder o mais rápido possível, geralmente em alguns dias úteis.\n\nObrigado por falar com a gente.`);
      return { to: body.to, subject: "Recebemos sua mensagem — PipocaCentral", html: shell("Mensagem recebida", inner), text: "Recebemos sua mensagem e vamos responder em breve. — PipocaCentral", replyTo: owner, restricted: false };
    }
    case "admin_reply": {
      if (!isEmail(body.to)) throw new HttpError(400, "Destinatário inválido", "bad-recipient");
      const subject = String(body.subject || "Resposta do PipocaCentral").slice(0, 120);
      return { to: body.to, subject, html: shell(subject, paragraphs(body.text)), text: String(body.text || ""), replyTo: owner, restricted: true };
    }
    case "admin_invite": {
      if (!isEmail(body.to)) throw new HttpError(400, "Destinatário inválido", "bad-recipient");
      const link = /^https:\/\/[^\s"<>]+$/.test(String(body.panelUrl || "")) ? body.panelUrl : "";
      const inner = `${paragraphs("Você foi convidado para a equipe administrativa do PipocaCentral.\n\nEntre no painel com este mesmo e-mail (por Google ou e-mail e senha) e o acesso será liberado automaticamente.")}${link ? `<p><a href="${escHtml(link)}" style="display:inline-block;background:#FFC857;color:#171200;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">Abrir o painel</a></p>` : ""}`;
      return { to: body.to, subject: "Convite para o painel do PipocaCentral", html: shell("Convite para a equipe", inner), text: `Você foi convidado para o painel do PipocaCentral. ${link}`, replyTo: owner, restricted: true };
    }
    default:
      throw new HttpError(400, "Tipo de e-mail desconhecido", "bad-type");
  }
}

async function mail(request, env) {
  if (!env.RESEND_API_KEY) throw new HttpError(503, "RESEND_API_KEY não configurada no Worker", "mail-not-configured");
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const internal = await sameSecret(bearer, env.MAIL_SHARED_SECRET);
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "JSON inválido", "bad-json");
  }
  const message = buildMail(body, env);

  if (!internal) {
    if (!message.restricted) throw new HttpError(403, "Sem permissão para este tipo de e-mail", "forbidden");
    const admin = await requireAdmin(request, env);
    const ok = await allow(env, `mail:${admin.sub}`, 30, 3600);
    if (!ok) throw new HttpError(429, "Muitos e-mails em pouco tempo", "rate-limited");
  }

  const payload = {
    from: env.MAIL_FROM || "PipocaCentral <onboarding@resend.dev>",
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.replyTo) payload.reply_to = message.replyTo;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status === 429 ? 429 : 502, data.message || "O Resend recusou o envio", "resend-error");
  }
  return { ok: true, id: data.id || null };
}

const GEMINI_RULES = [
  "Escreva sempre em português do Brasil, com tom natural, claro e sem clichês de marketing.",
  "Todo texto deve ser original: nunca copie trechos de sinopses, críticas, biografias ou matérias existentes.",
  "Não invente fatos. Quando não tiver certeza de um dado (data, nome, número, prêmio), escreva [VERIFICAR] ao lado.",
  "Não revele spoilers fora de uma seção explicitamente marcada como spoiler.",
  "Não produza conteúdo ofensivo, discriminatório, sexual explícito ou que promova pirataria.",
  "Devolva apenas o texto pedido, sem introdução do tipo 'Claro!' e sem explicar o que fez.",
].join(" ");

const GEMINI_TASKS = {
  synopsis: "Tarefa: escrever uma sinopse curta (60 a 110 palavras), sem spoilers, a partir dos dados fornecidos.",
  news: "Tarefa: escrever um rascunho de notícia de cinema/séries com título sugerido na primeira linha, depois o texto em markdown simples (parágrafos curtos, subtítulos com ##). Termine com uma linha 'Resumo:' de até 160 caracteres.",
  review: "Tarefa: escrever um rascunho de análise crítica em markdown simples, com opinião fundamentada, sem spoilers no corpo. Depois liste 'Pontos positivos:' e 'Pontos negativos:' em tópicos curtos.",
  seo: "Tarefa: sugerir um título (até 60 caracteres) e uma meta descrição (até 155 caracteres) para a página descrita.",
  rewrite: "Tarefa: reescrever o texto fornecido melhorando clareza e fluidez, mantendo o sentido e o tamanho aproximado.",
  chat: "Tarefa: responder como assistente editorial do portal PipocaCentral, de forma objetiva.",
};

async function gemini(request, env) {
  const admin = await requireAdmin(request, env);
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(503, "A chave do Gemini ainda não foi configurada no Worker (variável GEMINI_API_KEY).", "gemini-not-configured");
  }
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "JSON inválido", "bad-json");
  }
  const task = GEMINI_TASKS[body.task] ? body.task : "chat";
  const prompt = String(body.prompt || "").trim().slice(0, 6000);
  const context = String(body.context || "").trim().slice(0, 6000);
  if (prompt.length < 3) throw new HttpError(400, "Escreva o que você quer gerar", "empty");

  const hourly = await allow(env, `gem-h:${admin.sub}`, GEMINI_LIMITS.perHour, 3600);
  const daily = await allow(env, `gem-d:${admin.sub}`, GEMINI_LIMITS.perDay, 86400);
  if (!hourly || !daily) throw new HttpError(429, "Limite do assistente atingido. Tente mais tarde.", "rate-limited");

  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const text = context ? `Dados de apoio:\n${context}\n\nPedido:\n${prompt}` : prompt;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${GEMINI_RULES} ${GEMINI_TASKS[task]}` }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error && data.error.message ? data.error.message : "o Gemini recusou o pedido";
    throw new HttpError(response.status === 429 ? 429 : 502, `Gemini: ${detail}`, "gemini-error");
  }
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new HttpError(422, "O Gemini bloqueou esse pedido. Reformule o texto.", "gemini-blocked");
  }
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const output = parts.map((p) => p.text || "").join("").trim();
  if (!output) throw new HttpError(502, "O Gemini não devolveu texto. Tente de novo.", "gemini-empty");
  return { ok: true, text: output, model, task };
}

export default {
  async fetch(request, env) {
    const origin = (request.headers.get("Origin") || "").replace(/\/+$/, "");
    let cors = {};
    if (origin) {
      if (!origins(env).includes(origin)) return reply({ ok: false, error: "Origem não autorizada" }, 403);
      cors = corsFor(origin);
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return reply({ ok: true }, 200, cors);
      if (request.method === "GET" && url.pathname.startsWith("/sheets/")) return reply(await sheets(request, env, url), 200, cors);
      if (request.method === "POST" && url.pathname === "/mail/send") return reply(await mail(request, env), 200, cors);
      if (request.method === "POST" && url.pathname === "/gemini/generate") return reply(await gemini(request, env), 200, cors);
      return reply({ ok: false, error: "Rota não encontrada" }, 404, cors);
    } catch (error) {
      if (error instanceof HttpError) return reply({ ok: false, error: error.message, code: error.code }, error.status, cors);
      return reply({ ok: false, error: "Erro interno do Worker", code: "internal" }, 500, cors);
    }
  },
};
