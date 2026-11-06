import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/tmdb/index.js";
import { installFetch, jsonResponse } from "./helpers.js";

const ORIGIN = "https://painel-teste.vercel.app";
const ENV = { TMDB_API_KEY: "a".repeat(32), ALLOWED_ORIGINS: `${ORIGIN}, https://outro.dev/`, INTERNAL_SECRET: "interno" };
let mock;
let store;

function ctx() {
  return { waitUntil: (p) => p };
}

function req(path, { origin = ORIGIN, headers = {}, method = "GET" } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  return new Request(`https://tmbd.example.workers.dev${path}`, { method, headers: h });
}

beforeEach(() => {
  store = new Map();
  globalThis.caches = {
    default: {
      match: async (r) => {
        const hit = store.get(r.url);
        return hit ? hit.clone() : undefined;
      },
      put: async (r, res) => {
        store.set(r.url, res);
      },
    },
  };
  mock = installFetch([["api.themoviedb.org", () => jsonResponse({ results: [{ id: 1 }] })]]);
});

afterEach(() => mock.restore());

test("bloqueia origem fora da lista e acesso sem origem nem segredo", async () => {
  assert.equal((await worker.fetch(req("/tmdb/search/movie?query=duna", { origin: "https://intruso.com" }), ENV, ctx())).status, 403);
  assert.equal((await worker.fetch(req("/tmdb/search/movie?query=duna", { origin: null }), ENV, ctx())).status, 403);
});

test("libera origem autorizada com CORS, mesmo com barra final na lista", async () => {
  const res = await worker.fetch(req("/tmdb/search/movie?query=duna", { origin: "https://outro.dev" }), ENV, ctx());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://outro.dev");
});

test("chamada de servidor com segredo interno funciona sem origem", async () => {
  const res = await worker.fetch(req("/tmdb/movie/693134", { origin: null, headers: { Authorization: "Bearer interno" } }), ENV, ctx());
  assert.equal(res.status, 200);
});

test("injeta a chave só no servidor, remove api_key do cliente e força pt-BR sem adulto", async () => {
  await worker.fetch(req("/tmdb/search/movie?query=duna&api_key=ROUBADA"), ENV, ctx());
  const call = mock.calls.find((c) => c.url.includes("themoviedb"));
  const u = new URL(call.url);
  assert.equal(u.searchParams.get("api_key"), "a".repeat(32));
  assert.equal(u.searchParams.get("language"), "pt-BR");
  assert.equal(u.searchParams.get("include_adult"), "false");
  assert.ok(!call.url.includes("ROUBADA"));
});

test("token v4 (eyJ...) vai no header Authorization", async () => {
  await worker.fetch(req("/tmdb/movie/603"), { ...ENV, TMDB_API_KEY: "eyJhbGciOiJIUzI1NiJ9.x.y" }, ctx());
  const call = mock.calls.find((c) => c.url.includes("themoviedb"));
  assert.equal(call.init.headers.Authorization, "Bearer eyJhbGciOiJIUzI1NiJ9.x.y");
  assert.ok(!call.url.includes("api_key"));
});

test("só rotas permitidas passam", async () => {
  for (const path of ["/tmdb/account/123", "/tmdb/authentication/token/new", "/tmdb/movie/abc", "/tmdb/../account", "/qualquer"]) {
    assert.equal((await worker.fetch(req(path), ENV, ctx())).status, 404, path);
  }
  for (const path of ["/tmdb/movie/603/credits", "/tmdb/tv/1399/season/1", "/tmdb/person/287/combined_credits", "/tmdb/movie/603/watch/providers", "/tmdb/trending/movie/week"]) {
    assert.equal((await worker.fetch(req(path), ENV, ctx())).status, 200, path);
  }
});

test("segunda chamada igual vem do cache", async () => {
  const first = await worker.fetch(req("/tmdb/movie/603"), ENV, ctx());
  assert.equal(first.headers.get("x-cache"), "MISS");
  await new Promise((r) => setTimeout(r, 5));
  const second = await worker.fetch(req("/tmdb/movie/603"), ENV, ctx());
  assert.equal(second.headers.get("x-cache"), "HIT");
  assert.equal(mock.calls.filter((c) => c.url.includes("themoviedb")).length, 1);
});

test("sem chave configurada responde 503 e não aceita métodos de escrita", async () => {
  assert.equal((await worker.fetch(req("/tmdb/movie/603"), { ...ENV, TMDB_API_KEY: undefined }, ctx())).status, 503);
  assert.equal((await worker.fetch(req("/tmdb/movie/603", { method: "POST" }), ENV, ctx())).status, 405);
});
