import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalize, slugify, searchTokens, queryToken, matchesQuery, formatDuration, esc, jsonLd, isoDuration, timeAgo, imageUrl } from "../js/shared/util.js";
import { renderMarkdown } from "../js/shared/markdown.js";
import { cardTitle, cardNews, cardPerson } from "../js/shared/cards.js";
import { needsReview } from "../lib/moderation.js";
import { aggregate } from "../lib/ratings.js";

test("normalize e slugify tiram acentos e símbolos", () => {
  assert.equal(normalize("  Duna: Parte Dois! "), "duna parte dois");
  assert.equal(normalize("Amélie Poulain — São Paulo"), "amelie poulain sao paulo");
  assert.equal(slugify("Duna: Parte Dois"), "duna-parte-dois");
  assert.equal(slugify("¿Qué?!"), "que");
});

test("tokens de busca permitem achar por prefixo de qualquer palavra", () => {
  const tokens = searchTokens("Duna: Parte Dois", "Dune: Part Two");
  for (const t of ["du", "dun", "duna", "par", "parte", "dois", "dune", "tw", "two"]) assert.ok(tokens.includes(t), t);
  assert.ok(tokens.length <= 150);
  assert.equal(queryToken("parte dois"), "parte");
  assert.equal(queryToken("a du"), "du");
  assert.equal(queryToken("a"), "");
  assert.ok(searchTokens("duna parte").includes(queryToken("dun")));
});

test("qualquer palavra longa da busca encontra o título pelo token escolhido", () => {
  const titulo = "O Senhor dos Anéis: A Sociedade do Anel";
  const tokens = searchTokens(titulo);
  for (const consulta of ["senhor", "aneis", "sociedade anel", "soc"]) assert.ok(tokens.includes(queryToken(consulta)), consulta);
  assert.ok(matchesQuery(normalize(titulo), "sociedade anel"));
  assert.ok(!matchesQuery(normalize(titulo), "matrix"));
});

test("formatadores", () => {
  assert.equal(formatDuration(166), "2h 46min");
  assert.equal(formatDuration(120), "2h");
  assert.equal(formatDuration(45), "45min");
  assert.equal(formatDuration(0), "");
  assert.equal(isoDuration(166), "PT2H46M");
  assert.equal(imageUrl("/a.jpg", "w185"), "https://image.tmdb.org/t/p/w185/a.jpg");
  assert.equal(imageUrl("https://x.com/a.jpg"), "https://x.com/a.jpg");
  assert.equal(timeAgo("2026-01-01T00:00:00Z", new Date("2026-01-01T03:00:00Z").getTime()), "há 3 h");
});

test("esc e jsonLd neutralizam HTML", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  const out = jsonLd({ a: "</script><script>alert(1)</script>" });
  assert.ok(!out.includes("</script>"));
  assert.deepEqual(JSON.parse(out), { a: "</script><script>alert(1)</script>" });
});

test("markdown escapa HTML, bloqueia javascript: e renderiza o básico", () => {
  const html = renderMarkdown("## Título\n\nTexto **forte** e *itálico* com [link](https://exemplo.com) e [ruim](javascript:alert(1)).\n\n- um\n- dois\n\n1. a\n2. b\n\n<script>alert(1)</script>");
  assert.ok(html.includes("<h2>Título</h2>"));
  assert.ok(html.includes("<strong>forte</strong>"));
  assert.ok(html.includes('<a href="https://exemplo.com" rel="noopener nofollow" target="_blank">link</a>'));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes("<ul><li>um</li><li>dois</li></ul>"));
  assert.ok(html.includes("<ol><li>a</li><li>b</li></ol>"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("cards escapam títulos maliciosos e não quebram sem dados", () => {
  const evil = { type: "movie", slug: "x", title: `<img src=x onerror=alert(1)>`, genres: ["Ação"], year: 2024 };
  const html = cardTitle(evil);
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!/undefined|null|NaN/.test(cardTitle({ type: "series", slug: "s", title: "S" })));
  assert.ok(!/undefined|null|NaN/.test(cardPerson({ slug: "p", name: "P" })));
  assert.ok(!/undefined|null|NaN/.test(cardNews({ slug: "n", title: "N" })));
});

test("moderação manda links e palavrões para revisão", () => {
  assert.equal(needsReview("Filme muito bom, amei o final"), false);
  assert.equal(needsReview("Veja em www.golpe.com agora"), true);
  assert.equal(needsReview("acesse https://x.co"), true);
  assert.equal(needsReview("que porra de filme"), true);
  assert.equal(needsReview("meu passatempo preferido"), false);
});

test("nota agregada: bayesiana puxa poucas avaliações para a média geral", () => {
  assert.deepEqual(aggregate(0, 0), { ratingAvg: 0, rankScore: 0 });
  const few = aggregate(5, 1);
  const many = aggregate(500, 100);
  assert.equal(few.ratingAvg, 5);
  assert.ok(few.rankScore < many.rankScore);
  assert.ok(many.rankScore > 4.7 && many.rankScore <= 5);
});

test("cópias duplicadas no painel continuam idênticas", () => {
  const pairs = [
    ["js/shared/util.js", "painel/js/lib/util.js"],
    ["lib/admin.js", "painel/lib/admin.js"],
    ["lib/http.js", "painel/lib/http.js"],
    ["lib/mail.js", "painel/lib/mail.js"],
    ["css/tokens.css", "painel/css/tokens.css"],
    ["css/base.css", "painel/css/base.css"],
    ["css/components.css", "painel/css/components.css"],
  ];
  for (const [a, b] of pairs) assert.equal(readFileSync(a, "utf8"), readFileSync(b, "utf8"), `${a} difere de ${b}`);
});
