import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRating } from "../lib/ratings.js";

function fakeDb(initial) {
  const store = new Map(Object.entries(initial));
  const ref = (path) => ({ path });
  const snap = (path) => ({ exists: store.has(path), data: () => store.get(path) });
  return {
    store,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = {
        get: async (r) => snap(r.path),
        update: (r, data) => writes.push(() => store.set(r.path, { ...store.get(r.path), ...data })),
        set: (r, data) => writes.push(() => store.set(r.path, data)),
        delete: (r) => writes.push(() => store.delete(r.path)),
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
  };
}

const base = () => ({ "movies/duna": { title: "Duna", status: "published", ratingSum: 0, ratingCount: 0, ratingDist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } });

test("primeira nota soma, trocar nota ajusta, remover zera", async () => {
  const db = fakeDb(base());
  let r = await applyRating(db, { type: "movie", slug: "duna", uid: "u1", value: 5 });
  assert.equal(r.ratingCount, 1);
  assert.equal(r.ratingAvg, 5);
  assert.equal(db.store.get("ratings/movie_duna_u1").value, 5);

  r = await applyRating(db, { type: "movie", slug: "duna", uid: "u2", value: 3 });
  assert.equal(r.ratingCount, 2);
  assert.equal(r.ratingAvg, 4);

  r = await applyRating(db, { type: "movie", slug: "duna", uid: "u1", value: 1 });
  assert.equal(r.ratingCount, 2);
  assert.equal(r.ratingSum, 4);
  assert.equal(r.ratingDist[5], 0);
  assert.equal(r.ratingDist[1], 1);

  r = await applyRating(db, { type: "movie", slug: "duna", uid: "u1", value: 0 });
  assert.equal(r.ratingCount, 1);
  assert.equal(db.store.has("ratings/movie_duna_u1"), false);
  assert.equal(db.store.get("movies/duna").ratingSum, 3);
});

test("remover nota que não existe não mexe nos totais", async () => {
  const db = fakeDb(base());
  const r = await applyRating(db, { type: "movie", slug: "duna", uid: "u9", value: 0 });
  assert.equal(r.ratingCount, 0);
  assert.equal(db.store.get("movies/duna").ratingSum, 0);
});

test("título inexistente ou em rascunho recusa; exclusão de conta tolera título removido", async () => {
  const db = fakeDb({ "movies/rasc": { title: "R", status: "draft" } });
  await assert.rejects(() => applyRating(db, { type: "movie", slug: "nao-existe", uid: "u", value: 4 }), /não encontrado/);
  await assert.rejects(() => applyRating(db, { type: "movie", slug: "rasc", uid: "u", value: 4 }), /não encontrado/);
  db.store.set("ratings/movie_sumiu_u", { value: 4 });
  const r = await applyRating(db, { type: "movie", slug: "sumiu", uid: "u", value: 0, tolerateMissing: true });
  assert.equal(r, null);
  assert.equal(db.store.has("ratings/movie_sumiu_u"), false);
});

test("séries usam a coleção series", async () => {
  const db = fakeDb({ "series/s1": { title: "S", status: "published", ratingSum: 0, ratingCount: 0 } });
  const r = await applyRating(db, { type: "series", slug: "s1", uid: "u", value: 4 });
  assert.equal(r.ratingAvg, 4);
  assert.ok(db.store.has("ratings/series_s1_u"));
});
