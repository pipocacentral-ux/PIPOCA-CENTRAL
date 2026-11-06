import { getDb, serializeDoc } from "../lib/admin.js";
import { layout, notFoundBody } from "../lib/layout.js";
import { moviePage, seriesPage, personPage, newsPage, reviewPage, listPage } from "../lib/pages.js";

const COLLECTIONS = {
  filme: "movies",
  serie: "series",
  ator: "people",
  noticia: "news",
  analise: "reviews",
  lista: "lists",
};

function originOf(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function queryDocs(query) {
  const snap = await query.get();
  return snap.docs.map(serializeDoc);
}

async function publishedBySlugs(db, collection, slugs) {
  const unique = [...new Set(slugs.filter(Boolean))].slice(0, 30);
  if (!unique.length) return [];
  const snaps = await db.getAll(...unique.map((slug) => db.collection(collection).doc(slug)));
  return snaps.map(serializeDoc).filter((d) => d && d.status === "published");
}

async function newsAbout(db, slug) {
  return queryDocs(
    db.collection("news")
      .where("status", "==", "published")
      .where("relatedSlugs", "array-contains", slug)
      .orderBy("publishedAt", "desc")
      .limit(3)
  );
}

async function similar(db, collection, doc, type) {
  const genre = (doc.genres || [])[0];
  if (!genre) return [];
  const docs = await queryDocs(
    db.collection(collection)
      .where("status", "==", "published")
      .where("genres", "array-contains", genre)
      .orderBy("popularity", "desc")
      .limit(8)
  );
  return docs.filter((d) => d.slug !== doc.slug).slice(0, 6).map((d) => ({ ...d, type }));
}

async function build(kind, doc, db, origin) {
  if (kind === "filme" || kind === "serie") {
    const isMovie = kind === "filme";
    const type = isMovie ? "movie" : "series";
    const collection = isMovie ? "movies" : "series";
    const [related, news, people] = await Promise.all([
      similar(db, collection, doc, type),
      newsAbout(db, doc.slug),
      publishedBySlugs(db, "people", (doc.cast || []).map((c) => c.slug)),
    ]);
    const ctx = { origin, related, news, linkable: new Set(people.map((p) => p.slug)) };
    return isMovie ? moviePage({ ...doc, type }, ctx) : seriesPage({ ...doc, type }, ctx);
  }
  if (kind === "ator") {
    const known = doc.knownFor || [];
    const movieIds = known.filter((k) => k.mediaType !== "tv").map((k) => k.tmdbId).filter(Boolean).slice(0, 30);
    const tvIds = known.filter((k) => k.mediaType === "tv").map((k) => k.tmdbId).filter(Boolean).slice(0, 30);
    const [movies, series, news] = await Promise.all([
      movieIds.length ? queryDocs(db.collection("movies").where("status", "==", "published").where("tmdbId", "in", movieIds)) : [],
      tvIds.length ? queryDocs(db.collection("series").where("status", "==", "published").where("tmdbId", "in", tvIds)) : [],
      newsAbout(db, doc.slug),
    ]);
    const existing = [...movies.map((d) => ({ ...d, type: "movie" })), ...series.map((d) => ({ ...d, type: "series" }))];
    const have = new Set(existing.map((d) => d.tmdbId));
    const others = known.filter((k) => !have.has(k.tmdbId));
    return personPage(doc, { origin, existing, others, news });
  }
  if (kind === "noticia") {
    const related = (
      await queryDocs(db.collection("news").where("status", "==", "published").orderBy("publishedAt", "desc").limit(4))
    ).filter((n) => n.slug !== doc.slug).slice(0, 3);
    return newsPage(doc, { origin, related });
  }
  if (kind === "analise") {
    let target = null;
    if (doc.targetSlug) {
      const col = doc.targetType === "series" ? "series" : "movies";
      const snap = await db.collection(col).doc(doc.targetSlug).get();
      if (snap.exists && snap.data().status === "published") target = { type: doc.targetType, slug: doc.targetSlug };
    }
    return reviewPage(doc, { origin, target });
  }
  const refs = (doc.items || []).slice(0, 100);
  const movieSlugs = refs.filter((i) => i.type !== "series").map((i) => i.slug);
  const seriesSlugs = refs.filter((i) => i.type === "series").map((i) => i.slug);
  const [movies, series] = await Promise.all([
    publishedBySlugs(db, "movies", movieSlugs),
    publishedBySlugs(db, "series", seriesSlugs),
  ]);
  const byKey = new Map([
    ...movies.map((d) => [`movie_${d.slug}`, { ...d, type: "movie" }]),
    ...series.map((d) => [`series_${d.slug}`, { ...d, type: "series" }]),
  ]);
  const entries = refs
    .map((i) => {
      const found = byKey.get(`${i.type === "series" ? "series" : "movie"}_${i.slug}`);
      return found ? { ...found, note: i.note || "" } : null;
    })
    .filter(Boolean);
  return listPage(doc, { origin, entries });
}

function send(res, status, html, cache) {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.send(html);
}

function sendNotFound(res) {
  const html = layout({
    title: "Página não encontrada | PipocaCentral",
    noindex: true,
    body: notFoundBody(),
    pageScript: "/js/pages/base.js",
  });
  send(res, 404, html, "public, s-maxage=60, stale-while-revalidate=300");
}

export default async function handler(req, res) {
  const kind = String(req.query.t || "");
  const slug = String(req.query.s || "").toLowerCase();
  const collection = COLLECTIONS[kind];
  if (!collection || !/^[a-z0-9-]{1,100}$/.test(slug)) return sendNotFound(res);

  try {
    const db = getDb();
    const snap = await db.collection(collection).doc(slug).get();
    const doc = serializeDoc(snap);
    if (!doc || doc.status !== "published") return sendNotFound(res);
    const page = await build(kind, { ...doc, slug: doc.slug || slug }, db, originOf(req));
    send(res, 200, layout(page), "public, s-maxage=300, stale-while-revalidate=3600");
  } catch (error) {
    console.error("render", kind, slug, error);
    const html = layout({
      title: "Erro temporário | PipocaCentral",
      noindex: true,
      body: `<main id="main"><div class="container coming-soon"><h1 style="font-size:var(--fs-xl)">Algo deu errado por aqui</h1><p>Tente de novo em alguns instantes.</p><a href="/" class="btn btn-primary">Voltar ao início</a></div></main>`,
      pageScript: "/js/pages/base.js",
    });
    send(res, 500, html, "no-store");
  }
}
