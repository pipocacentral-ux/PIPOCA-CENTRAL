import { normalize, searchTokens } from "./util.js";

const STATUS = [{ value: "draft", label: "Rascunho" }, { value: "published", label: "Publicado" }];
const TYPES = [{ value: "movie", label: "Filme" }, { value: "series", label: "Série" }];

const mediaCommon = [
  { name: "originalTitle", label: "Título original" },
  { name: "year", label: "Ano", type: "number" },
  { name: "releaseDate", label: "Data de lançamento", type: "date" },
  { name: "genres", label: "Gêneros", type: "tags", hint: "Separe por vírgula." },
  { name: "certification", label: "Classificação indicativa", hint: "Ex.: Livre, 12 anos, 16 anos." },
  { name: "country", label: "País" },
  { name: "synopsis", label: "Sinopse", type: "textarea", full: true, ai: "synopsis" },
  { name: "posterPath", label: "Pôster", hint: "Caminho do TMDB (/abc.jpg) ou link https://." },
  { name: "backdropPath", label: "Imagem de fundo", hint: "Caminho do TMDB ou link https://." },
  { name: "trailerKey", label: "Trailer (código do YouTube)", hint: "O trecho depois de v= no link do vídeo." },
  { name: "platforms", label: "Onde assistir", type: "tags", hint: "Separe por vírgula. Ex.: Netflix, Max." },
  { name: "popularity", label: "Popularidade", type: "number", hint: "Quanto maior, mais alto aparece na home." },
  { name: "tmdbId", label: "ID no TMDB", type: "number" },
];

export const KINDS = {
  movies: {
    col: "movies", label: "Filmes", singular: "filme", titleField: "title", media: true, searchable: true, type: "movie", publicPath: "/filmes/",
    tmdb: "movie", sheet: "filmes",
    fields: [
      { name: "title", label: "Título", required: true },
      ...mediaCommon.slice(0, 3),
      { name: "duration", label: "Duração (minutos)", type: "number" },
      ...mediaCommon.slice(3, 4),
      { name: "director", label: "Direção" },
      { name: "writers", label: "Roteiro", type: "tags" },
      ...mediaCommon.slice(4),
      { name: "cast", label: "Elenco (JSON)", type: "json", full: true, rows: 7, hint: 'Lista com name, character, photoPath e slug. Ex.: [{"name":"Zendaya","character":"Chani","slug":"zendaya"}]' },
      { name: "status", label: "Situação", type: "select", options: STATUS },
    ],
    columns: [{ label: "Título", get: (d) => d.title }, { label: "Ano", get: (d) => d.year || "" }, { label: "Notas", get: (d) => d.ratingCount || 0 }],
  },
  series: {
    col: "series", label: "Séries", singular: "série", titleField: "title", media: true, searchable: true, type: "series", publicPath: "/series/",
    tmdb: "tv", sheet: "series",
    fields: [
      { name: "title", label: "Título", required: true },
      ...mediaCommon.slice(0, 3),
      { name: "yearsText", label: "Período exibido", hint: "Ex.: 2022– ou 2018–2023." },
      { name: "statusText", label: "Estado da série", type: "select", options: ["", "Em exibição", "Finalizada", "Cancelada", "Em breve"] },
      { name: "seasonsCount", label: "Nº de temporadas", type: "number" },
      { name: "episodeRuntime", label: "Duração por episódio (min)", type: "number" },
      { name: "creators", label: "Criação", type: "tags" },
      ...mediaCommon.slice(3),
      { name: "cast", label: "Elenco (JSON)", type: "json", full: true, rows: 7 },
      { name: "seasons", label: "Temporadas (JSON)", type: "json", full: true, rows: 8, hint: 'Ex.: [{"number":1,"name":"Temporada 1","episodeCount":8,"episodes":[{"number":1,"name":"Piloto","runtime":45}]}]' },
      { name: "status", label: "Situação", type: "select", options: STATUS },
    ],
    columns: [{ label: "Título", get: (d) => d.title }, { label: "Período", get: (d) => d.yearsText || d.year || "" }, { label: "Notas", get: (d) => d.ratingCount || 0 }],
  },
  people: {
    col: "people", label: "Elenco", singular: "pessoa", titleField: "name", searchable: true, publicPath: "/elenco/", tmdb: "person",
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "role", label: "Profissão", hint: "Ex.: Ator, Atriz, Diretor." },
      { name: "born", label: "Nascimento", hint: "Ano ou data." },
      { name: "nationality", label: "Nacionalidade" },
      { name: "bio", label: "Biografia", type: "textarea", full: true, rows: 6, ai: "synopsis" },
      { name: "photoPath", label: "Foto", hint: "Caminho do TMDB ou link https://." },
      { name: "popularity", label: "Popularidade", type: "number" },
      { name: "tmdbId", label: "ID no TMDB", type: "number" },
      { name: "knownFor", label: "Conhecido(a) por (JSON)", type: "json", full: true, rows: 6, hint: 'Lista com mediaType (movie ou tv), tmdbId, title, year.' },
      { name: "status", label: "Situação", type: "select", options: STATUS },
    ],
    columns: [{ label: "Nome", get: (d) => d.name }, { label: "Profissão", get: (d) => d.role || "" }],
  },
  news: {
    col: "news", label: "Notícias", singular: "notícia", titleField: "title", dated: true, publicPath: "/noticias/",
    fields: [
      { name: "title", label: "Título", required: true, full: true },
      { name: "category", label: "Categoria", type: "select", options: ["Notícias", "Lançamentos", "Bastidores", "Listas", "Guia", "Entrevistas", "Streaming"] },
      { name: "author", label: "Autor(a)" },
      { name: "excerpt", label: "Resumo (aparece nos cards e no Google)", type: "textarea", rows: 3, full: true },
      { name: "body", label: "Texto", type: "textarea", rows: 16, full: true, required: true, ai: "news", hint: "Markdown simples: ## Subtítulo, - lista, **negrito**, [texto](https://link)." },
      { name: "coverUrl", label: "Imagem de capa (link https://)", type: "url", full: true },
      { name: "relatedTitles", label: "Títulos relacionados (JSON)", type: "json", full: true, rows: 4, hint: 'Ex.: [{"type":"movie","slug":"duna-parte-dois","title":"Duna: Parte Dois"}]' },
      { name: "status", label: "Situação", type: "select", options: STATUS },
    ],
    columns: [{ label: "Título", get: (d) => d.title }, { label: "Categoria", get: (d) => d.category || "" }],
  },
  reviews: {
    col: "reviews", label: "Análises", singular: "análise", titleField: "title", dated: true, publicPath: "/analises/",
    fields: [
      { name: "title", label: "Título", required: true, full: true },
      { name: "targetType", label: "Tipo do título analisado", type: "select", options: TYPES },
      { name: "targetSlug", label: "Endereço (slug) do título", hint: "Ex.: duna-parte-dois" },
      { name: "targetTitle", label: "Nome do título analisado" },
      { name: "score", label: "Nota (0 a 5)", type: "number" },
      { name: "author", label: "Autor(a)" },
      { name: "excerpt", label: "Resumo", type: "textarea", rows: 3, full: true },
      { name: "body", label: "Texto (sem spoilers)", type: "textarea", rows: 14, full: true, required: true, ai: "review" },
      { name: "pros", label: "Pontos positivos (um por linha)", type: "lines" },
      { name: "cons", label: "Pontos negativos (um por linha)", type: "lines" },
      { name: "spoilerBody", label: "Área com spoilers (opcional)", type: "textarea", rows: 6, full: true },
      { name: "coverUrl", label: "Imagem de capa (link https://)", type: "url", full: true },
      { name: "status", label: "Situação", type: "select", options: STATUS },
    ],
    columns: [{ label: "Título", get: (d) => d.title }, { label: "Nota", get: (d) => d.score ?? "" }],
  },
  lists: {
    col: "lists", label: "Listas", singular: "lista", titleField: "title", dated: true, publicPath: "/listas/",
    fields: [
      { name: "title", label: "Título", required: true, full: true },
      { name: "description", label: "Descrição", type: "textarea", rows: 3, full: true },
      { name: "coverUrl", label: "Imagem de capa (link https://)", type: "url", full: true },
      { name: "items", label: "Títulos da lista, em ordem (JSON)", type: "json", full: true, rows: 10, required: true, hint: 'Ex.: [{"type":"movie","slug":"duna-parte-dois","note":"Texto opcional"}]' },
      { name: "status", label: "Situação", type: "select", options: STATUS },
    ],
    columns: [{ label: "Título", get: (d) => d.title }, { label: "Itens", get: (d) => (d.items || []).length }],
  },
  platforms: {
    col: "platforms", label: "Plataformas", singular: "plataforma", titleField: "name", plain: true, sheet: "plataformas",
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "logoUrl", label: "Logo (link https://)", type: "url" },
      { name: "order", label: "Ordem", type: "number" },
    ],
    columns: [{ label: "Nome", get: (d) => d.name }, { label: "Ordem", get: (d) => d.order ?? "" }],
  },
  avatars: {
    col: "avatars", label: "Avatares", singular: "avatar", titleField: "name", plain: true, sheet: "avatares",
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "url", label: "Imagem (link https://)", type: "url", required: true },
      { name: "order", label: "Ordem", type: "number" },
    ],
    columns: [{ label: "Nome", get: (d) => d.name }, { label: "Ordem", get: (d) => d.order ?? "" }],
  },
};

function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

export function colorFromText(text) {
  let hash = 0;
  for (const ch of String(text || "")) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return [hslToHex(hash % 360, 38, 17), "#171821"];
}

function validHttps(value) {
  return !value || /^https:\/\/\S+$/.test(value) || value.startsWith("/");
}

export function buildDoc(kindKey, input, existing = null) {
  const kind = KINDS[kindKey];
  const doc = { ...(existing || {}), ...input };
  delete doc.id;
  const title = String(doc[kind.titleField] || "").trim();
  if (!title) throw new Error("O título é obrigatório.");
  doc[kind.titleField] = title;

  for (const field of kind.fields) {
    if ((field.type === "url") && !validHttps(doc[field.name])) throw new Error(`“${field.label}” precisa começar com https://.`);
    if (field.type === "select" && field.name === "status" && !["draft", "published"].includes(doc.status)) doc.status = "draft";
  }

  if (kind.plain) {
    doc.order = Number.isFinite(Number(doc.order)) && doc.order !== null && doc.order !== "" ? Number(doc.order) : 0;
    return doc;
  }

  doc.status = doc.status === "published" ? "published" : "draft";

  if (kind.searchable) {
    const secondary = kind.media ? doc.originalTitle : "";
    doc.titleNorm = normalize([title, secondary].filter(Boolean).join(" "));
    doc.searchTokens = searchTokens(title, secondary);
    doc.popularity = Number(doc.popularity) || 0;
  }

  if (kind.media) {
    doc.ratingSum ??= 0;
    doc.ratingCount ??= 0;
    doc.ratingAvg ??= 0;
    doc.rankScore ??= 0;
    doc.ratingDist ??= { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    doc.releaseDate = doc.releaseDate || "";
    if (doc.year === null || doc.year === undefined || doc.year === "") {
      doc.year = doc.releaseDate ? Number(doc.releaseDate.slice(0, 4)) || null : null;
    }
    doc.genres = Array.isArray(doc.genres) ? doc.genres : [];
    doc.platforms = Array.isArray(doc.platforms) ? doc.platforms : [];
    doc.cast = Array.isArray(doc.cast) ? doc.cast : [];
  }

  if (kindKey === "news") {
    doc.relatedTitles = Array.isArray(doc.relatedTitles) ? doc.relatedTitles : [];
    doc.relatedSlugs = doc.relatedTitles.map((r) => r && r.slug).filter(Boolean);
  }
  if (kindKey === "reviews") {
    if (doc.score !== null && doc.score !== undefined && (doc.score < 0 || doc.score > 5)) throw new Error("A nota precisa estar entre 0 e 5.");
  }
  if (kindKey === "lists") {
    if (!Array.isArray(doc.items) || !doc.items.length) throw new Error("A lista precisa ter pelo menos um título.");
  }

  doc.color = Array.isArray(doc.color) && doc.color.length === 2 ? doc.color : colorFromText(title);
  return doc;
}
