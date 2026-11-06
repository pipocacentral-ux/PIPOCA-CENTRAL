import { test } from "node:test";
import assert from "node:assert/strict";
import { moviePage, seriesPage, personPage, newsPage, reviewPage, listPage } from "../lib/pages.js";
import { layout, notFoundBody } from "../lib/layout.js";

const origin = "https://exemplo.com";

const movie = {
  type: "movie", slug: "duna-parte-dois", title: "Duna: Parte Dois", originalTitle: "Dune: Part Two", year: 2024, releaseDate: "2024-02-29",
  duration: 166, director: "Denis Villeneuve", writers: ["Jon Spaihts"], genres: ["Ficção científica", "Aventura"], certification: "14 anos",
  synopsis: "Paul Atreides se une aos Fremen.", posterPath: "/p.jpg", trailerKey: "Way9Dexny3w", platforms: ["Max"],
  cast: [{ name: "Zendaya", character: "Chani", slug: "zendaya", photoPath: "/z.jpg" }, { name: "Sem Ficha", character: "X", slug: "sem-ficha" }],
  ratingCount: 4, ratingAvg: 4.5, ratingDist: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 }, color: ["#2b2140", "#171821"],
};

function clean(html) {
  assert.ok(!/>\s*(undefined|null|NaN)\s*</.test(html), "texto undefined/null/NaN visível");
  assert.ok(!/(undefined|NaN)/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "valor undefined/NaN no HTML");
}

test("página de filme tem SEO, dados para hidratação e links só para elenco publicado", () => {
  const page = moviePage(movie, { origin, related: [], news: [], linkable: new Set(["zendaya"]) });
  const html = layout(page);
  clean(html);
  assert.match(html, /<title>Duna: Parte Dois \(2024\)/);
  assert.match(html, /<link rel="canonical" href="https:\/\/exemplo\.com\/filmes\/duna-parte-dois">/);
  assert.match(html, /data-type="movie" data-slug="duna-parte-dois"/);
  assert.match(html, /data-trailer="Way9Dexny3w"/);
  assert.match(html, /href="\/elenco\/zendaya"/);
  assert.ok(!html.includes('href="/elenco/sem-ficha"'));
  assert.match(html, /2h 46min/);
  assert.match(html, /<link rel="stylesheet" href="\/css\/tokens\.css">/);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(ld[0]["@type"], "Movie");
  assert.equal(ld[0].aggregateRating.reviewCount, "4");
  assert.equal(ld[1]["@type"], "BreadcrumbList");
});

test("sem avaliações não gera aggregateRating e mostra traço", () => {
  const html = layout(moviePage({ ...movie, ratingCount: 0, ratingAvg: 0, ratingDist: {} }, { origin }));
  assert.ok(!html.includes("aggregateRating"));
  assert.match(html, /data-rating-value>—</);
  assert.match(html, /Ainda sem avaliações/);
});

test("conteúdo com HTML malicioso sai escapado em todas as páginas", () => {
  const evil = `<script>alert(1)</script>`;
  const pages = [
    moviePage({ ...movie, title: evil, synopsis: evil, director: evil, genres: [evil], platforms: [evil], cast: [{ name: evil, character: evil, slug: "a" }] }, { origin }),
    seriesPage({ ...movie, type: "series", title: evil, synopsis: evil, seasons: [{ number: 1, name: evil, episodes: [{ number: 1, name: evil }] }], creators: [evil] }, { origin }),
    personPage({ slug: "p", name: evil, bio: evil, role: evil }, { origin }),
    newsPage({ slug: "n", title: evil, body: evil, author: evil, category: evil, coverUrl: `https://x.com/"><script>`, relatedTitles: [{ type: "movie", slug: "a", title: evil }] }, { origin }),
    reviewPage({ slug: "r", title: evil, body: evil, pros: [evil], cons: [evil], spoilerBody: evil, targetTitle: evil }, { origin }),
    listPage({ slug: "l", title: evil, description: evil }, { origin, entries: [{ ...movie, title: evil, note: evil }] }),
  ];
  for (const page of pages) {
    const html = layout(page);
    const withoutJson = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "").replace(/<script[^>]*src=[^>]*><\/script>/g, "");
    assert.ok(!withoutJson.includes("<script>alert(1)"), page.title);
    assert.ok(!html.includes("</script><script>alert"), page.title);
  }
});

test("série mostra temporadas e período", () => {
  const page = seriesPage({ type: "series", slug: "s", title: "Série X", yearsText: "2022–", statusText: "Em exibição", seasonsCount: 2, seasons: [{ number: 1, name: "Temporada 1", episodeCount: 8, episodes: [{ number: 1, name: "Piloto", runtime: 45 }] }, { number: 2, name: "Temporada 2", episodeCount: 6, episodes: [] }], genres: ["Drama"], creators: ["Fulana"], ratingCount: 0 }, { origin });
  const html = layout(page);
  clean(html);
  assert.match(html, /Temporada 1/);
  assert.match(html, /1\. Piloto/);
  assert.match(html, /6 episódios/);
  assert.match(html, /pill-live/);
  assert.equal(JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@type"], "TVSeries");
});

test("notícia, análise e lista renderizam com metadados", () => {
  const news = layout(newsPage({ slug: "n", title: "Título", body: "## Sub\n\nTexto", excerpt: "Resumo", author: "Ana", category: "Notícias", publishedAt: "2026-05-01T12:00:00.000Z" }, { origin }));
  clean(news);
  assert.match(news, /<h2>Sub<\/h2>/);
  assert.match(news, /NewsArticle/);
  const review = layout(reviewPage({ slug: "r", title: "Análise", body: "Texto", score: 4.5, pros: ["a"], cons: ["b"], targetTitle: "Filme" }, { origin, target: { type: "movie", slug: "filme" } }));
  clean(review);
  assert.match(review, /Nota 4\.5\/5/);
  assert.match(review, /href="\/filmes\/filme"/);
  const list = layout(listPage({ slug: "l", title: "Lista", description: "Desc" }, { origin, entries: [{ ...movie, note: "Nota" }] }));
  clean(list);
  assert.match(list, /ItemList/);
  assert.match(list, /href="\/filmes\/duna-parte-dois"/);
});

test("página de elenco separa filmografia existente e outros trabalhos", () => {
  const html = layout(personPage({ slug: "z", name: "Zendaya", role: "Atriz", born: "1996", bio: "Bio" }, { origin, existing: [movie], others: [{ title: "Euphoria", year: 2019 }] }));
  clean(html);
  assert.match(html, /Filmografia/);
  assert.match(html, /Euphoria \(2019\)/);
});

test("página 404 tem noindex", () => {
  const html = layout({ title: "x", noindex: true, body: notFoundBody(), pageScript: "/js/pages/base.js" });
  assert.match(html, /<meta name="robots" content="noindex">/);
});
