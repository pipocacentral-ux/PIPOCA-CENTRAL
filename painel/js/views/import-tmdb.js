import { esc, imageUrl, slugify } from "../lib/util.js";
import { $, toast, openModal, setBusy } from "../lib/ui.js";
import { tmdb } from "../lib/api.js";
import { KINDS } from "../lib/schema.js";
import { mapMovie, mapSeries, mapPerson, mapCastToPerson } from "../lib/tmdb-map.js";
import { db } from "../firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { saveDoc, uniqueSlug } from "./crud.js";

const SEARCH_PATH = { movies: "search/movie", series: "search/tv", people: "search/person" };

function resultLine(kindKey, r) {
  if (kindKey === "people") {
    return { title: r.name, sub: r.known_for_department || "", image: r.profile_path, id: r.id };
  }
  const title = kindKey === "movies" ? r.title : r.name;
  const date = kindKey === "movies" ? r.release_date : r.first_air_date;
  return { title, sub: String(date || "").slice(0, 4), image: r.poster_path, id: r.id, overview: r.overview };
}

export async function importOne(kindKey, tmdbId, { withCast = false } = {}) {
  if (kindKey === "movies") {
    const data = await tmdb(`movie/${tmdbId}`, { append_to_response: "credits,videos,release_dates,watch/providers", include_video_language: "pt,en,null" });
    return mapMovie(data);
  }
  if (kindKey === "series") {
    const data = await tmdb(`tv/${tmdbId}`, { append_to_response: "aggregate_credits,videos,content_ratings,watch/providers", include_video_language: "pt,en,null" });
    const wanted = (data.seasons || []).filter((s) => s.season_number > 0).slice(0, 12);
    const details = [];
    for (let i = 0; i < wanted.length; i += 4) {
      const chunk = await Promise.allSettled(wanted.slice(i, i + 4).map((s) => tmdb(`tv/${tmdbId}/season/${s.season_number}`)));
      chunk.forEach((r) => r.status === "fulfilled" && details.push(r.value));
    }
    return mapSeries(data, details);
  }
  const data = await tmdb(`person/${tmdbId}`, { append_to_response: "combined_credits" });
  return mapPerson(data);
}

async function createCastDrafts(cast) {
  let created = 0;
  for (const member of cast) {
    if (!member.slug) continue;
    const snap = await getDoc(doc(db, "people", member.slug));
    if (snap.exists()) continue;
    await saveDoc("people", member.slug, { ...mapCastToPerson(member), status: "draft" });
    created += 1;
  }
  return created;
}

export function openTmdbImport(kindKey, onDone) {
  const kind = KINDS[kindKey];
  const body = document.createElement("div");
  body.innerHTML = `
    <form class="toolbar" data-search-form>
      <input type="search" class="search" placeholder="Digite o nome para buscar no TMDB" aria-label="Buscar no TMDB" required data-q>
      <button type="submit" class="btn btn-primary btn-sm">Buscar</button>
    </form>
    ${kindKey === "people" ? "" : `<label class="check-line"><input type="checkbox" data-cast> Criar também as fichas do elenco como rascunho (para você completar e publicar depois)</label>`}
    <label class="check-line"><input type="checkbox" data-publish> Publicar direto, sem revisar</label>
    <div data-results class="results"></div>`;
  const modal = openModal({ title: `Importar ${kind.singular} do TMDB`, body, wide: true });
  const results = $("[data-results]", body);

  $("[data-search-form]", body).addEventListener("submit", async (event) => {
    event.preventDefault();
    results.innerHTML = `<p class="muted">Buscando...</p>`;
    try {
      const data = await tmdb(SEARCH_PATH[kindKey], { query: $("[data-q]", body).value.trim() });
      const list = (data.results || []).slice(0, 12).map((r) => resultLine(kindKey, r));
      results.innerHTML = list.length
        ? list.map((r) => `<div class="result">
            ${r.image ? `<img src="${esc(imageUrl(r.image, "w92"))}" alt="" width="46" height="69" loading="lazy">` : `<div class="noimg"></div>`}
            <div class="grow"><strong>${esc(r.title)}</strong><div class="muted">${esc(r.sub)}</div>${r.overview ? `<p class="clamp">${esc(r.overview)}</p>` : ""}</div>
            <button type="button" class="btn btn-secondary btn-sm" data-import="${r.id}">Importar</button></div>`).join("")
        : `<p class="muted">Nada encontrado. Tente outro nome.</p>`;
    } catch (error) {
      results.innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
    }
  });

  results.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-import]");
    if (!button) return;
    setBusy(button, true, "Importando...");
    try {
      const input = await importOne(kindKey, Number(button.dataset.import));
      const title = input[kind.titleField];
      const slug = await uniqueSlug(kindKey, title, input.tmdbId, input.year);
      const existingSnap = await getDoc(doc(db, kind.col, slug));
      const existing = existingSnap.exists() ? { id: slug, ...existingSnap.data() } : null;
      input.status = $("[data-publish]", body).checked ? "published" : existing ? existing.status : "draft";
      await saveDoc(kindKey, slug, input, { existing });
      let extra = "";
      if ($("[data-cast]", body)?.checked && input.cast) extra = ` + ${await createCastDrafts(input.cast)} ficha(s) de elenco`;
      toast(`“${title}” importado${extra}.`);
      button.textContent = "Importado";
      onDone?.();
    } catch (error) {
      toast(error.message, "error");
      setBusy(button, false);
    }
  });
  return modal;
}
