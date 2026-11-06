import { slugify } from "./util.js";

const COUNTRIES = {
  "United States of America": "Estados Unidos", "United Kingdom": "Reino Unido", France: "França", Germany: "Alemanha",
  Italy: "Itália", Spain: "Espanha", Japan: "Japão", "South Korea": "Coreia do Sul", Canada: "Canadá", Brazil: "Brasil",
  Mexico: "México", Argentina: "Argentina", Australia: "Austrália", Ireland: "Irlanda", India: "Índia", China: "China",
  Sweden: "Suécia", Denmark: "Dinamarca", Norway: "Noruega", Netherlands: "Países Baixos", Belgium: "Bélgica",
  Portugal: "Portugal", Russia: "Rússia", Poland: "Polônia", "New Zealand": "Nova Zelândia", Austria: "Áustria",
  Switzerland: "Suíça", Turkey: "Turquia", Thailand: "Tailândia", "Hong Kong": "Hong Kong", Taiwan: "Taiwan", Iceland: "Islândia",
};

const SERIES_STATUS = {
  "Returning Series": "Em exibição", Ended: "Finalizada", Canceled: "Cancelada", "In Production": "Em breve", Planned: "Em breve", Pilot: "Em breve",
};

export function countryPt(name) {
  return COUNTRIES[name] || name || "";
}

export function certLabel(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (!value) return "";
  if (value === "L" || value === "LIVRE") return "Livre";
  const n = value.match(/\d+/);
  return n ? `${n[0]} anos` : "";
}

function year(date) {
  const y = Number(String(date || "").slice(0, 4));
  return y || null;
}

function providers(data) {
  const br = data && data["watch/providers"] && data["watch/providers"].results && data["watch/providers"].results.BR;
  if (!br) return [];
  const all = [...(br.flatrate || []), ...(br.free || []), ...(br.ads || [])].map((p) => p.provider_name);
  return [...new Set(all)];
}

function trailer(data) {
  const list = ((data.videos && data.videos.results) || []).filter((v) => v.site === "YouTube" && /^[\w-]{6,20}$/.test(v.key || ""));
  const rank = (v) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 2 : 4) + (v.iso_639_1 === "pt" ? 0 : v.iso_639_1 === "en" ? 1 : 3) + (v.official ? 0 : 0.5);
  list.sort((a, b) => rank(a) - rank(b));
  return list[0] ? list[0].key : "";
}

function castList(list, characterOf) {
  return (list || [])
    .filter((c) => c.name)
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      character: characterOf(c) || "",
      photoPath: c.profile_path || "",
      tmdbId: c.id,
      slug: slugify(c.name),
    }));
}

export function mapMovie(d) {
  const crew = (d.credits && d.credits.crew) || [];
  const brRelease = ((d.release_dates && d.release_dates.results) || []).find((r) => r.iso_3166_1 === "BR");
  const cert = brRelease ? (brRelease.release_dates.find((x) => x.certification) || {}).certification : "";
  const writers = [...new Set(crew.filter((c) => ["Screenplay", "Writer", "Story"].includes(c.job)).map((c) => c.name))].slice(0, 3);
  return {
    title: d.title,
    originalTitle: d.original_title || "",
    year: year(d.release_date),
    releaseDate: d.release_date || "",
    duration: d.runtime || null,
    certification: certLabel(cert),
    director: (crew.find((c) => c.job === "Director") || {}).name || "",
    writers,
    country: countryPt(((d.production_countries || [])[0] || {}).name),
    genres: (d.genres || []).map((g) => g.name),
    synopsis: d.overview || "",
    posterPath: d.poster_path || "",
    backdropPath: d.backdrop_path || "",
    trailerKey: trailer(d),
    platforms: providers(d),
    cast: castList(d.credits && d.credits.cast, (c) => c.character),
    popularity: Math.round((d.popularity || 0) * 10) / 10,
    tmdbId: d.id,
  };
}

export function mapSeries(d, seasonDetails = []) {
  const brRating = ((d.content_ratings && d.content_ratings.results) || []).find((r) => r.iso_3166_1 === "BR");
  const first = year(d.first_air_date);
  const last = year(d.last_air_date);
  const ended = ["Ended", "Canceled"].includes(d.status);
  const yearsText = first ? (ended ? (last && last !== first ? `${first}–${last}` : `${first}`) : `${first}–`) : "";
  const byNumber = new Map(seasonDetails.map((s) => [s.season_number, s]));
  const seasons = (d.seasons || [])
    .filter((s) => s.season_number > 0)
    .map((s) => {
      const detail = byNumber.get(s.season_number);
      return {
        number: s.season_number,
        name: s.name || `Temporada ${s.season_number}`,
        episodeCount: s.episode_count || 0,
        episodes: detail ? (detail.episodes || []).map((e) => ({ number: e.episode_number, name: e.name || "", runtime: e.runtime || null })) : [],
      };
    });
  const runtimes = seasons.flatMap((s) => s.episodes.map((e) => e.runtime)).filter(Boolean);
  const avg = runtimes.length ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : null;
  return {
    title: d.name,
    originalTitle: d.original_name || "",
    year: first,
    releaseDate: d.first_air_date || "",
    yearsText,
    statusText: SERIES_STATUS[d.status] || "",
    seasonsCount: (d.number_of_seasons || seasons.length) || null,
    episodeRuntime: (d.episode_run_time && d.episode_run_time[0]) || avg,
    certification: certLabel(brRating && brRating.rating),
    creators: (d.created_by || []).map((c) => c.name),
    country: countryPt(((d.production_countries || [])[0] || {}).name || (d.origin_country || [])[0]),
    genres: (d.genres || []).map((g) => g.name),
    synopsis: d.overview || "",
    posterPath: d.poster_path || "",
    backdropPath: d.backdrop_path || "",
    trailerKey: trailer(d),
    platforms: providers(d),
    cast: castList(d.aggregate_credits && d.aggregate_credits.cast, (c) => (c.roles && c.roles[0] && c.roles[0].character) || ""),
    seasons,
    popularity: Math.round((d.popularity || 0) * 10) / 10,
    tmdbId: d.id,
  };
}

export function personRole(d) {
  const dept = d.known_for_department;
  if (dept === "Acting") return d.gender === 1 ? "Atriz" : d.gender === 2 ? "Ator" : "Ator/Atriz";
  if (dept === "Directing") return "Direção";
  if (dept === "Writing") return "Roteiro";
  if (dept === "Production") return "Produção";
  return dept || "";
}

export function mapPerson(d) {
  const credits = ((d.combined_credits && d.combined_credits.cast) || [])
    .filter((c) => (c.title || c.name) && (c.media_type === "movie" || c.media_type === "tv"))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 16)
    .map((c) => ({
      mediaType: c.media_type,
      tmdbId: c.id,
      title: c.title || c.name,
      year: year(c.release_date || c.first_air_date),
      posterPath: c.poster_path || "",
    }));
  const place = String(d.place_of_birth || "").split(",").pop().trim();
  return {
    name: d.name,
    role: personRole(d),
    born: d.birthday ? String(year(d.birthday) || "") : "",
    nationality: countryPt(place),
    bio: d.biography || "",
    photoPath: d.profile_path || "",
    popularity: Math.round((d.popularity || 0) * 10) / 10,
    tmdbId: d.id,
    knownFor: credits,
  };
}

export function mapCastToPerson(c) {
  return {
    name: c.name,
    role: "",
    photoPath: c.photoPath || "",
    popularity: 0,
    tmdbId: c.tmdbId,
    knownFor: [],
    bio: "",
    born: "",
    nationality: "",
  };
}
