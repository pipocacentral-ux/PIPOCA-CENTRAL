import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDoc, colorFromText, KINDS } from "../painel/js/lib/schema.js";
import { mapMovie, mapSeries, mapPerson, certLabel, countryPt } from "../painel/js/lib/tmdb-map.js";
import { autoMap, rowToInput, splitList, youtubeKey } from "../painel/js/lib/sheet-map.js";
import { queryToken } from "../js/shared/util.js";

test("buildDoc cria campos que as consultas do site exigem", () => {
  const doc = buildDoc("movies", { title: "Duna: Parte Dois", originalTitle: "Dune: Part Two", genres: ["Ficção científica"], releaseDate: "2024-02-29", status: "published" });
  for (const field of ["ratingSum", "ratingCount", "ratingAvg", "rankScore", "ratingDist", "popularity", "releaseDate", "titleNorm", "searchTokens", "color", "status"]) {
    assert.ok(field in doc, field);
  }
  assert.equal(doc.year, 2024);
  assert.equal(doc.titleNorm, "duna parte dois dune part two");
  assert.ok(doc.searchTokens.includes(queryToken("parte")));
  assert.equal(doc.status, "published");
  assert.match(doc.color[0], /^#[0-9a-f]{6}$/);
});

test("buildDoc preserva avaliações existentes ao editar e força rascunho em status inválido", () => {
  const existing = { title: "X", ratingSum: 9, ratingCount: 2, ratingAvg: 4.5, rankScore: 4.1, ratingDist: { 4: 1, 5: 1 }, color: ["#111111", "#222222"] };
  const doc = buildDoc("movies", { title: "X editado", status: "qualquer" }, existing);
  assert.equal(doc.ratingCount, 2);
  assert.equal(doc.rankScore, 4.1);
  assert.deepEqual(doc.color, ["#111111", "#222222"]);
  assert.equal(doc.status, "draft");
});

test("buildDoc valida notícias, análises, listas e URLs", () => {
  assert.throws(() => buildDoc("movies", { title: "" }), /obrigatório/);
  assert.throws(() => buildDoc("reviews", { title: "A", score: 7 }), /entre 0 e 5/);
  assert.throws(() => buildDoc("lists", { title: "L", items: [] }), /pelo menos um/);
  assert.throws(() => buildDoc("news", { title: "N", body: "x", coverUrl: "http://inseguro.com/a.jpg" }), /https/);
  const news = buildDoc("news", { title: "N", body: "x", relatedTitles: [{ type: "movie", slug: "duna", title: "Duna" }, { slug: "outro" }] });
  assert.deepEqual(news.relatedSlugs, ["duna", "outro"]);
  const avatar = buildDoc("avatars", { name: "A", url: "https://x.com/a.png", order: "3" });
  assert.equal(avatar.order, 3);
});

test("colorFromText é estável", () => {
  assert.deepEqual(colorFromText("Duna"), colorFromText("Duna"));
  assert.notDeepEqual(colorFromText("Duna"), colorFromText("Matrix"));
});

const TMDB_MOVIE = {
  id: 693134, title: "Duna: Parte Dois", original_title: "Dune: Part Two", release_date: "2024-02-27", runtime: 167, overview: "Sinopse.",
  poster_path: "/p.jpg", backdrop_path: "/b.jpg", popularity: 123.456, genres: [{ name: "Ficção científica" }, { name: "Aventura" }],
  production_countries: [{ name: "United States of America" }],
  credits: {
    cast: [{ id: 1, name: "Timothée Chalamet", character: "Paul", profile_path: "/t.jpg" }, { id: 2, name: "Zendaya", character: "Chani", profile_path: null }],
    crew: [{ job: "Director", name: "Denis Villeneuve" }, { job: "Screenplay", name: "Jon Spaihts" }, { job: "Screenplay", name: "Denis Villeneuve" }],
  },
  videos: { results: [{ site: "YouTube", key: "teaser0001", type: "Teaser", iso_639_1: "en" }, { site: "YouTube", key: "Way9Dexny3w", type: "Trailer", iso_639_1: "pt", official: true }, { site: "Vimeo", key: "xxxxxxxx", type: "Trailer" }] },
  release_dates: { results: [{ iso_3166_1: "US", release_dates: [{ certification: "PG-13" }] }, { iso_3166_1: "BR", release_dates: [{ certification: "" }, { certification: "14" }] }] },
  "watch/providers": { results: { BR: { flatrate: [{ provider_name: "Max" }], ads: [{ provider_name: "Pluto TV" }, { provider_name: "Max" }] } } },
};

test("mapMovie traduz o payload do TMDB para o formato do site", () => {
  const m = mapMovie(TMDB_MOVIE);
  assert.equal(m.title, "Duna: Parte Dois");
  assert.equal(m.year, 2024);
  assert.equal(m.duration, 167);
  assert.equal(m.director, "Denis Villeneuve");
  assert.deepEqual(m.writers, ["Jon Spaihts", "Denis Villeneuve"]);
  assert.equal(m.certification, "14 anos");
  assert.equal(m.country, "Estados Unidos");
  assert.equal(m.trailerKey, "Way9Dexny3w");
  assert.deepEqual(m.platforms, ["Max", "Pluto TV"]);
  assert.equal(m.cast[0].slug, "timothee-chalamet");
  assert.equal(m.cast[1].photoPath, "");
  assert.equal(m.popularity, 123.5);
  assert.equal(m.tmdbId, 693134);
  const doc = buildDoc("movies", { ...m, status: "draft" });
  assert.ok(doc.searchTokens.length > 5);
});

test("mapMovie aguenta payload quase vazio", () => {
  const m = mapMovie({ id: 1, title: "Só título" });
  assert.equal(m.year, null);
  assert.deepEqual(m.genres, []);
  assert.deepEqual(m.cast, []);
  assert.equal(m.trailerKey, "");
  assert.equal(buildDoc("movies", { ...m }).year, null);
});

test("mapSeries monta temporadas, período e estado", () => {
  const data = {
    id: 1399, name: "Série X", original_name: "Series X", first_air_date: "2011-04-17", last_air_date: "2019-05-19", status: "Ended",
    number_of_seasons: 2, episode_run_time: [], created_by: [{ name: "Fulano" }], genres: [{ name: "Drama" }], origin_country: ["US"],
    seasons: [{ season_number: 0, name: "Especiais", episode_count: 3 }, { season_number: 1, name: "Temporada 1", episode_count: 2 }, { season_number: 2, name: "Temporada 2", episode_count: 1 }],
    content_ratings: { results: [{ iso_3166_1: "BR", rating: "16" }] },
    aggregate_credits: { cast: [{ id: 9, name: "Ator Um", roles: [{ character: "Herói" }] }] },
  };
  const details = [{ season_number: 1, episodes: [{ episode_number: 1, name: "A", runtime: 50 }, { episode_number: 2, name: "B", runtime: 60 }] }];
  const s = mapSeries(data, details);
  assert.equal(s.yearsText, "2011–2019");
  assert.equal(s.statusText, "Finalizada");
  assert.equal(s.seasons.length, 2);
  assert.equal(s.seasons[0].episodes[1].runtime, 60);
  assert.equal(s.episodeRuntime, 55);
  assert.equal(s.certification, "16 anos");
  assert.equal(s.cast[0].character, "Herói");
  assert.equal(mapSeries({ ...data, status: "Returning Series", last_air_date: "2024-01-01" }).yearsText, "2011–");
});

test("mapPerson e rótulos", () => {
  const p = mapPerson({ id: 5, name: "Zendaya", gender: 1, known_for_department: "Acting", birthday: "1996-09-01", place_of_birth: "Oakland, California, USA", biography: "Bio", profile_path: "/z.jpg", popularity: 50,
    combined_credits: { cast: [{ media_type: "movie", id: 1, title: "Duna", release_date: "2021-10-01", popularity: 90 }, { media_type: "tv", id: 2, name: "Euphoria", first_air_date: "2019-06-16", popularity: 70 }, { media_type: "movie", id: 3, popularity: 1 }] } });
  assert.equal(p.role, "Atriz");
  assert.equal(p.born, "1996");
  assert.equal(p.knownFor.length, 2);
  assert.equal(p.knownFor[0].title, "Duna");
  assert.equal(certLabel("L"), "Livre");
  assert.equal(certLabel("12"), "12 anos");
  assert.equal(certLabel(""), "");
  assert.equal(countryPt("Atlantis"), "Atlantis");
});

test("planilha: reconhece colunas por cabeçalho, ignora extras e converte valores", () => {
  const columns = ["Título", "Ano", "Gênero", "Sinopse", "Plataforma", "Direção", "Elenco", "Poster", "Trailer", "Duração", "Coluna J", "Coluna K"].map((name, i) => ({ letter: String.fromCharCode(65 + i), name }));
  const mapping = autoMap("filmes", columns);
  assert.equal(mapping.title, 0);
  assert.equal(mapping.genres, 2);
  assert.equal(mapping.director, 5);
  assert.equal(mapping.duration, 9);
  const used = new Set(Object.values(mapping).filter((v) => v >= 0));
  assert.ok(!used.has(10) && !used.has(11));
  const row = ["Duna: Parte Dois", "2024", "Ficção científica, Aventura", "Sinopse longa", "Max; Netflix", "Denis Villeneuve", "Zendaya, Timothée Chalamet", "http://img.com/p.jpg", "https://www.youtube.com/watch?v=Way9Dexny3w", "2h 46min", "lixo", "lixo"];
  const input = rowToInput("filmes", row, mapping);
  assert.equal(input.year, 2024);
  assert.deepEqual(input.genres, ["Ficção científica", "Aventura"]);
  assert.deepEqual(input.platforms, ["Max", "Netflix"]);
  assert.equal(input.posterPath, "https://img.com/p.jpg");
  assert.equal(input.trailerKey, "Way9Dexny3w");
  assert.equal(input.duration, 166);
  assert.equal(input.cast.length, 2);
  assert.ok(!("lixo" in input) && !Object.values(input).includes("lixo"));
  const doc = buildDoc("movies", { ...input, status: "draft" });
  assert.equal(doc.title, "Duna: Parte Dois");
});

test("planilha: mapeamento manual e abas de plataformas e avatares", () => {
  const cols = [{ name: "Nome" }, { name: "Link" }, { name: "Ordem" }];
  const map = autoMap("avatares", cols);
  const a = rowToInput("avatares", ["Gato", "http://x.com/gato.png", "2"], map);
  assert.deepEqual(a, { name: "Gato", url: "https://x.com/gato.png", order: 2 });
  const p = rowToInput("plataformas", ["Netflix", "", ""], autoMap("plataformas", cols));
  assert.equal(p.name, "Netflix");
  assert.equal(rowToInput("filmes", ["X", "Y"], { title: 1 }).title, "Y");
  assert.deepEqual(splitList("a, b; c / d"), ["a", "b", "c", "d"]);
  assert.equal(youtubeKey("https://youtu.be/Way9Dexny3w?t=3"), "Way9Dexny3w");
  assert.equal(youtubeKey("lixo lixo"), "");
  assert.ok(KINDS.movies.fields.some((f) => f.ai === "synopsis"));
});
