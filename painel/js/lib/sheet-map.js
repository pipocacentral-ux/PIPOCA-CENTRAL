import { normalize } from "./util.js";

const COMMON = {
  title: ["titulo", "title", "nome do filme", "nome da serie", "nome", "filme", "serie"],
  originalTitle: ["titulo original", "original title", "nome original"],
  year: ["ano", "year", "ano de lancamento"],
  releaseDate: ["data de lancamento", "data lancamento", "estreia", "release date", "lancamento"],
  genres: ["generos", "genero", "genre", "genres", "categoria", "categorias"],
  synopsis: ["sinopse", "descricao", "resumo", "overview", "sobre"],
  platforms: ["plataformas", "plataforma", "onde assistir", "streaming"],
  posterPath: ["poster", "capa", "cartaz", "imagem", "image", "url da imagem", "link da imagem"],
  trailerKey: ["trailer", "link do trailer", "youtube"],
  tmdbId: ["tmdb id", "id tmdb", "tmdb", "id do tmdb"],
  certification: ["classificacao", "classificacao indicativa", "idade"],
  country: ["pais", "country", "origem"],
};

export const SHEET_FIELDS = {
  filmes: {
    kind: "movies",
    fields: {
      ...COMMON,
      duration: ["duracao", "minutos", "runtime", "tempo"],
      director: ["direcao", "diretor", "diretora", "director"],
      cast: ["elenco", "atores", "cast", "atores principais"],
    },
  },
  series: {
    kind: "series",
    fields: {
      ...COMMON,
      seasonsCount: ["temporadas", "seasons", "numero de temporadas"],
      statusText: ["status", "situacao", "estado"],
      creators: ["criador", "criadores", "criacao", "creator"],
      cast: ["elenco", "atores", "cast", "atores principais"],
    },
  },
  plataformas: {
    kind: "platforms",
    fields: {
      name: ["nome", "plataforma", "name", "titulo"],
      logoUrl: ["logo", "logotipo", "imagem", "url", "link", "icone"],
      order: ["ordem", "order", "posicao", "id"],
    },
  },
  avatares: {
    kind: "avatars",
    fields: {
      name: ["nome", "name", "titulo", "avatar"],
      url: ["url", "link", "imagem", "image", "foto"],
      order: ["ordem", "order", "posicao", "id"],
    },
  },
};

export function autoMap(tab, columns) {
  const def = SHEET_FIELDS[tab];
  const headers = columns.map((c) => normalize(c.name));
  const used = new Set();
  const mapping = {};
  for (const [field, aliases] of Object.entries(def.fields)) {
    let found = -1;
    for (const alias of aliases) {
      const exact = headers.findIndex((h, i) => !used.has(i) && h === alias);
      if (exact !== -1) {
        found = exact;
        break;
      }
    }
    if (found === -1) {
      for (const alias of aliases) {
        const loose = headers.findIndex((h, i) => !used.has(i) && h && h.includes(alias));
        if (loose !== -1) {
          found = loose;
          break;
        }
      }
    }
    mapping[field] = found;
    if (found !== -1) used.add(found);
  }
  return mapping;
}

export function splitList(value) {
  return String(value || "")
    .split(/[,;/|\n]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function youtubeKey(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^[\w-]{6,20}$/.test(v)) return v;
  const match = v.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,20})/);
  return match ? match[1] : "";
}

function toNumber(value) {
  const cleaned = String(value || "").replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return cleaned && Number.isFinite(n) ? n : null;
}

function toDuration(value) {
  const text = String(value || "").toLowerCase();
  const h = text.match(/(\d+)\s*h/);
  const m = text.match(/(\d+)\s*(?:min|m\b)/);
  if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return toNumber(text);
}

function toDate(value) {
  const v = String(value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return "";
}

function toHttps(value) {
  const v = String(value || "").trim();
  if (/^https:\/\//i.test(v)) return v;
  if (/^http:\/\//i.test(v)) return v.replace(/^http:/i, "https:");
  return "";
}

export function rowToInput(tab, row, mapping) {
  const get = (field) => (mapping[field] >= 0 && mapping[field] !== undefined ? String(row[mapping[field]] ?? "").trim() : "");
  const kind = SHEET_FIELDS[tab].kind;
  if (kind === "platforms") {
    return { name: get("name"), logoUrl: toHttps(get("logoUrl")), order: toNumber(get("order")) ?? 0 };
  }
  if (kind === "avatars") {
    return { name: get("name") || "Avatar", url: toHttps(get("url")), order: toNumber(get("order")) ?? 0 };
  }
  const input = {
    title: get("title"),
    originalTitle: get("originalTitle"),
    year: toNumber(get("year")),
    releaseDate: toDate(get("releaseDate")) || toDate(get("year")),
    genres: splitList(get("genres")),
    synopsis: get("synopsis"),
    platforms: splitList(get("platforms")),
    posterPath: toHttps(get("posterPath")),
    trailerKey: youtubeKey(get("trailerKey")),
    tmdbId: toNumber(get("tmdbId")),
    certification: get("certification"),
    country: get("country"),
  };
  input.cast = splitList(get("cast")).slice(0, 12).map((name) => ({ name, character: "", photoPath: "", slug: "" }));
  if (kind === "movies") {
    input.duration = toDuration(get("duration"));
    input.director = get("director");
  } else {
    input.seasonsCount = toNumber(get("seasonsCount"));
    input.statusText = get("statusText");
    input.creators = splitList(get("creators"));
  }
  for (const key of Object.keys(input)) {
    if (input[key] === null || input[key] === "" || (Array.isArray(input[key]) && !input[key].length)) delete input[key];
  }
  return input;
}
