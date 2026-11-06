import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/api/index.js";
import { makeKeys, signToken, installFetch, jsonResponse } from "./helpers.js";

const ORIGIN = "https://painel-teste.vercel.app";
const JWKS = "securetoken@system.gserviceaccount.com";
let keys;
let mock;

const ENV = {
  FIREBASE_PROJECT_ID: "pipoca-central",
  ALLOWED_ORIGINS: ORIGIN,
  RESEND_API_KEY: "re_test_key",
  MAIL_SHARED_SECRET: "segredo-interno",
  GEMINI_API_KEY: "gem-test-key",
};

function req(path, { method = "GET", token, body, origin = ORIGIN, headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h["Content-Type"] = "application/json";
  return new Request(`https://api.example.workers.dev${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
}

const CSV = 'Título,Ano,"Sinopse, longa",Extra\r\nDuna,2024,"Linha 1\nLinha 2 ""citada""",x\r\n\r\nOppenheimer,2023,Texto,y\r\n';

beforeEach(async () => {
  keys = keys || (await makeKeys());
  mock = installFetch([
    [JWKS, () => jsonResponse(keys.jwks, 200, { "cache-control": "public, max-age=3600" })],
    ["docs.google.com/spreadsheets", () => new Response(CSV, { status: 200, headers: { "content-type": "text/csv" } })],
    ["api.resend.com/emails", () => jsonResponse({ id: "email_1" })],
    ["generativelanguage.googleapis.com", () => jsonResponse({ candidates: [{ content: { parts: [{ text: "Texto gerado" }] } }] })],
  ]);
});

afterEach(() => mock.restore());

test("rejeita origem não autorizada", async () => {
  const res = await worker.fetch(req("/health", { origin: "https://site-qualquer.com" }), ENV);
  assert.equal(res.status, 403);
});

test("health responde com CORS para origem autorizada", async () => {
  const res = await worker.fetch(req("/health"), ENV);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
});

test("sheets exige token", async () => {
  const res = await worker.fetch(req("/sheets/filmes"), ENV);
  assert.equal(res.status, 401);
});

test("sheets recusa usuário comum", async () => {
  const token = await signToken(keys, { admin: false });
  const res = await worker.fetch(req("/sheets/filmes", { token }), ENV);
  assert.equal(res.status, 403);
});

test("sheets lê CSV com aspas, quebras de linha e ignora linhas vazias", async () => {
  const token = await signToken(keys, { admin: true });
  const res = await worker.fetch(req("/sheets/filmes", { token }), ENV);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.columns.map((c) => c.letter), ["A", "B", "C", "D"]);
  assert.equal(data.columns[2].name, "Sinopse, longa");
  assert.equal(data.total, 2);
  assert.equal(data.rows[0][2], 'Linha 1\nLinha 2 "citada"');
  assert.ok(mock.calls.find((c) => c.url.includes("gid=0")));
});

test("sheets usa o gid certo de cada aba e aceita preview", async () => {
  const token = await signToken(keys, { admin: true });
  await worker.fetch(req("/sheets/series?preview=1", { token }), ENV);
  assert.ok(mock.calls.find((c) => c.url.includes("gid=16873436")));
  const bad = await worker.fetch(req("/sheets/inexistente", { token }), ENV);
  assert.equal(bad.status, 404);
});

test("sheets avisa quando a planilha está privada", async () => {
  mock.restore();
  mock = installFetch([
    [JWKS, () => jsonResponse(keys.jwks)],
    ["docs.google.com", () => new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } })],
  ]);
  const token = await signToken(keys, { admin: true });
  const res = await worker.fetch(req("/sheets/filmes", { token }), ENV);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).code, "sheet-private");
});

test("letras de coluna passam de Z", async () => {
  const header = Array.from({ length: 28 }, (_, i) => `c${i}`).join(",");
  mock.restore();
  mock = installFetch([
    [JWKS, () => jsonResponse(keys.jwks)],
    ["docs.google.com", () => new Response(`${header}\n${header}\n`, { status: 200, headers: { "content-type": "text/csv" } })],
  ]);
  const token = await signToken(keys, { admin: true });
  const data = await (await worker.fetch(req("/sheets/filmes", { token }), ENV)).json();
  assert.equal(data.columns[25].letter, "Z");
  assert.equal(data.columns[26].letter, "AA");
  assert.equal(data.columns[27].letter, "AB");
});

test("token de outro projeto, expirado ou adulterado é recusado", async () => {
  const wrongProject = await signToken(keys, { admin: true }, { project: "outro-projeto" });
  assert.equal((await worker.fetch(req("/sheets/filmes", { token: wrongProject }), ENV)).status, 401);

  const expired = await signToken(keys, { admin: true }, { expiresIn: -3600 });
  assert.equal((await worker.fetch(req("/sheets/filmes", { token: expired }), ENV)).status, 401);

  const good = await signToken(keys, { admin: false });
  const [h, , s] = good.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ iss: "https://securetoken.google.com/pipoca-central", aud: "pipoca-central", sub: "x", exp: Math.floor(Date.now() / 1000) + 3600, admin: true })).toString("base64url");
  assert.equal((await worker.fetch(req("/sheets/filmes", { token: `${h}.${forgedPayload}.${s}` }), ENV)).status, 401);

  const otherKeys = await makeKeys("test-kid");
  const signedByStranger = await signToken(otherKeys, { admin: true });
  assert.equal((await worker.fetch(req("/sheets/filmes", { token: signedByStranger }), ENV)).status, 401);
});

test("mail: segredo interno envia aviso de contato para o dono, com reply-to do visitante e HTML escapado", async () => {
  const res = await worker.fetch(
    req("/mail/send", {
      method: "POST",
      origin: null,
      headers: { Authorization: "Bearer segredo-interno" },
      body: { type: "contact_notify", name: "Ana", email: "ana@exemplo.com", subject: "Sugestão", message: "<script>alert(1)</script> oi" },
    }),
    ENV
  );
  assert.equal(res.status, 200);
  const sent = mock.calls.find((c) => c.url.includes("api.resend.com"));
  const payload = JSON.parse(sent.init.body);
  assert.deepEqual(payload.to, ["pipocacentral@gmail.com"]);
  assert.equal(payload.reply_to, "ana@exemplo.com");
  assert.ok(!payload.html.includes("<script>alert"));
  assert.ok(payload.html.includes("&lt;script&gt;"));
  assert.equal(sent.init.headers.Authorization, "Bearer re_test_key");
  assert.match(payload.from, /onboarding@resend\.dev/);
});

test("mail: sem segredo e sem token é recusado; admin só envia tipos restritos", async () => {
  const anon = await worker.fetch(req("/mail/send", { method: "POST", body: { type: "contact_notify", name: "a", email: "a@a.com", subject: "x", message: "y" } }), ENV);
  assert.equal(anon.status, 403);

  const token = await signToken(keys, { admin: true });
  const notify = await worker.fetch(req("/mail/send", { method: "POST", token, body: { type: "contact_notify", name: "a", email: "a@a.com", subject: "x", message: "y" } }), ENV);
  assert.equal(notify.status, 403);

  const reply = await worker.fetch(req("/mail/send", { method: "POST", token, body: { type: "admin_reply", to: "ana@exemplo.com", subject: "Re: oi", text: "Olá\n\nTudo bem" } }), ENV);
  assert.equal(reply.status, 200);
  assert.ok(mock.calls.find((c) => c.url.includes("api.resend.com")));
});

test("mail: erro do Resend volta com a mensagem dele", async () => {
  mock.restore();
  mock = installFetch([
    [JWKS, () => jsonResponse(keys.jwks)],
    ["api.resend.com", () => jsonResponse({ message: "You can only send testing emails to your own email address." }, 403)],
  ]);
  const token = await signToken(keys, { admin: true });
  const res = await worker.fetch(req("/mail/send", { method: "POST", token, body: { type: "admin_reply", to: "ana@exemplo.com", subject: "Oi", text: "Teste" } }), ENV);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /testing emails/);
});

test("mail sem chave do Resend responde 503 claro", async () => {
  const res = await worker.fetch(req("/mail/send", { method: "POST", origin: null, headers: { Authorization: "Bearer segredo-interno" }, body: { type: "contact_notify" } }), { ...ENV, RESEND_API_KEY: undefined });
  assert.equal(res.status, 503);
});

test("gemini: sem chave configurada responde 503 amigável", async () => {
  const token = await signToken(keys, { admin: true });
  const res = await worker.fetch(req("/gemini/generate", { method: "POST", token, body: { task: "synopsis", prompt: "Duna 2" } }), { ...ENV, GEMINI_API_KEY: undefined });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, "gemini-not-configured");
});

test("gemini: gera texto, manda a chave no header e usa modelo padrão", async () => {
  const token = await signToken(keys, { admin: true });
  const res = await worker.fetch(req("/gemini/generate", { method: "POST", token, body: { task: "synopsis", prompt: "Duna: Parte Dois", context: "Ficção científica" } }), ENV);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.text, "Texto gerado");
  const call = mock.calls.find((c) => c.url.includes("generativelanguage"));
  assert.ok(call.url.includes("/models/gemini-flash-latest:generateContent"));
  assert.equal(call.init.headers["x-goog-api-key"], "gem-test-key");
  assert.ok(!call.url.includes("gem-test-key"));
  const sent = JSON.parse(call.init.body);
  assert.match(sent.systemInstruction.parts[0].text, /português do Brasil/);
});

test("gemini: usuário comum não usa e limite por hora é aplicado", async () => {
  const user = await signToken(keys, { admin: false });
  assert.equal((await worker.fetch(req("/gemini/generate", { method: "POST", token: user, body: { prompt: "oi oi" } }), ENV)).status, 403);

  const admin = await signToken(keys, { admin: true }, {});
  const adminToken = await signToken(keys, { admin: true, sub: "admin-limite" });
  let last;
  for (let i = 0; i < 21; i++) {
    last = await worker.fetch(req("/gemini/generate", { method: "POST", token: adminToken, body: { task: "chat", prompt: "pergunta " + i } }), ENV);
  }
  assert.equal(last.status, 429);
  assert.ok(admin);
});

test("gemini devolve erro claro quando a API recusa", async () => {
  mock.restore();
  mock = installFetch([
    [JWKS, () => jsonResponse(keys.jwks)],
    ["generativelanguage", () => jsonResponse({ error: { message: "API key not valid" } }, 400)],
  ]);
  const token = await signToken(keys, { admin: true, sub: "outro-admin" });
  const res = await worker.fetch(req("/gemini/generate", { method: "POST", token, body: { task: "news", prompt: "Notícia sobre cinema" } }), ENV);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /API key not valid/);
});
