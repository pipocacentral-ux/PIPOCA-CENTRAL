import { getDb } from "../lib/admin.js";

const STATIC = ["", "busca", "noticias", "analises", "listas", "lancamentos", "rankings", "sobre", "contato", "termos", "privacidade", "cookies"];

function originOf(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

async function slugs(db, collection, base, dateField) {
  const snap = await db.collection(collection).where("status", "==", "published").limit(5000).get();
  return snap.docs.map((d) => {
    const data = d.data();
    const raw = data[dateField] && data[dateField].toDate ? data[dateField].toDate() : null;
    return { loc: `${base}/${d.id}`, lastmod: raw ? raw.toISOString().slice(0, 10) : null };
  });
}

export default async function handler(req, res) {
  const origin = originOf(req);
  if (req.query.robots) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600");
    return res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /perfil\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`);
  }
  try {
    const db = getDb();
    const groups = await Promise.all([
      slugs(db, "movies", "/filmes", "updatedAt"),
      slugs(db, "series", "/series", "updatedAt"),
      slugs(db, "people", "/elenco", "updatedAt"),
      slugs(db, "news", "/noticias", "publishedAt"),
      slugs(db, "reviews", "/analises", "publishedAt"),
      slugs(db, "lists", "/listas", "publishedAt"),
    ]);
    const urls = [
      ...STATIC.map((p) => ({ loc: `/${p}`, lastmod: null })),
      ...groups.flat(),
    ].map((u) => {
      const loc = u.loc.startsWith("/") ? `${origin}${u.loc}` : u.loc;
      return `<url><loc>${xmlEscape(loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`;
    });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
  } catch (error) {
    console.error("sitemap", error);
    res.status(500).send("erro");
  }
}
