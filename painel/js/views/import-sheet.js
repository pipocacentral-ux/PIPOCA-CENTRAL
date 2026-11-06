import { esc, slugify } from "../lib/util.js";
import { $, toast, openModal, setBusy } from "../lib/ui.js";
import { workerApi, tmdb } from "../lib/api.js";
import { KINDS } from "../lib/schema.js";
import { SHEET_FIELDS, autoMap, rowToInput } from "../lib/sheet-map.js";
import { mapMovie, mapSeries } from "../lib/tmdb-map.js";
import { db } from "../firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { saveDoc, uniqueSlug } from "./crud.js";

const FIELD_LABELS = {
  title: "Título", originalTitle: "Título original", year: "Ano", releaseDate: "Data de lançamento", genres: "Gêneros", synopsis: "Sinopse",
  platforms: "Plataformas", posterPath: "Pôster (link)", trailerKey: "Trailer", tmdbId: "ID no TMDB", certification: "Classificação",
  country: "País", duration: "Duração", director: "Direção", cast: "Elenco", seasonsCount: "Temporadas", statusText: "Estado da série",
  creators: "Criação", name: "Nome", logoUrl: "Logo (link)", url: "Imagem (link)", order: "Ordem",
};

async function enrich(kindKey, input) {
  try {
    let id = input.tmdbId;
    if (!id && input.title) {
      const path = kindKey === "movies" ? "search/movie" : "search/tv";
      const found = await tmdb(path, { query: input.title, year: kindKey === "movies" ? input.year : undefined, first_air_date_year: kindKey === "series" ? input.year : undefined });
      id = found.results && found.results[0] && found.results[0].id;
    }
    if (!id) return input;
    const fromTmdb = kindKey === "movies"
      ? mapMovie(await tmdb(`movie/${id}`, { append_to_response: "credits,videos,release_dates,watch/providers", include_video_language: "pt,en,null" }))
      : mapSeries(await tmdb(`tv/${id}`, { append_to_response: "aggregate_credits,videos,content_ratings,watch/providers", include_video_language: "pt,en,null" }));
    const merged = { ...fromTmdb };
    for (const [key, value] of Object.entries(input)) {
      const has = Array.isArray(value) ? value.length : value !== null && value !== undefined && value !== "";
      if (has && !(key === "cast" && fromTmdb.cast && fromTmdb.cast.length)) merged[key] = value;
    }
    return merged;
  } catch {
    return input;
  }
}

export function openSheetImport(kindKey, onDone) {
  const kind = KINDS[kindKey];
  const tab = kind.sheet;
  const def = SHEET_FIELDS[tab];
  const body = document.createElement("div");
  body.innerHTML = `<p class="muted">Lendo a aba “${esc(tab)}” da planilha...</p>`;
  const modal = openModal({ title: `Importar da planilha (${tab})`, body, wide: true });
  let sheet = null;
  let mapping = {};

  function preview() {
    const sample = sheet.rows.slice(0, 3).map((row) => rowToInput(tab, row, mapping));
    $("[data-preview]", body).textContent = JSON.stringify(sample, null, 2);
  }

  function renderMapping() {
    const options = [`<option value="-1">— ignorar —</option>`, ...sheet.columns.map((c, i) => `<option value="${i}">${esc(c.letter)} · ${esc(c.name || "(sem nome)")}</option>`)].join("");
    body.innerHTML = `
      <p>Encontrei <strong>${sheet.total}</strong> linha(s). Confira qual coluna alimenta cada campo — colunas que você não escolher são ignoradas.</p>
      <div class="map-grid">${Object.keys(def.fields).map((field) => `<label class="field"><span>${esc(FIELD_LABELS[field] || field)}</span><select data-map="${field}">${options}</select></label>`).join("")}</div>
      <details open><summary>Prévia das 3 primeiras linhas</summary><pre class="preview" data-preview></pre></details>
      ${kind.media ? `<label class="check-line"><input type="checkbox" data-enrich> Completar com dados do TMDB (elenco, pôster, duração...). Mais lento.</label>` : ""}
      ${kind.plain ? "" : `<label class="check-line"><input type="checkbox" data-publish> Publicar direto, sem revisar</label>`}
      <label class="check-line"><input type="checkbox" data-overwrite> Atualizar itens que já existem</label>
      <div class="progress" data-progress hidden><div class="progress-bar" data-bar></div></div>
      <p class="muted" data-log></p>
      <div class="row-end"><button type="button" class="btn btn-primary" data-run>Importar ${sheet.total} linha(s)</button></div>`;
    $$map();
    preview();
  }

  function $$map() {
    body.querySelectorAll("[data-map]").forEach((select) => {
      select.value = String(mapping[select.dataset.map] ?? -1);
      select.addEventListener("change", () => {
        mapping[select.dataset.map] = Number(select.value);
        preview();
      });
    });
    $("[data-run]", body).addEventListener("click", run);
  }

  async function run(event) {
    const button = event.currentTarget;
    const requiredField = kind.plain ? kind.titleField : "title";
    if ((mapping[requiredField] ?? -1) < 0) {
      toast(`Escolha a coluna do campo “${FIELD_LABELS[requiredField]}”.`, "error");
      return;
    }
    setBusy(button, true, "Importando...");
    const enrichOn = $("[data-enrich]", body)?.checked;
    const publish = $("[data-publish]", body)?.checked;
    const overwrite = $("[data-overwrite]", body).checked;
    const progress = $("[data-progress]", body);
    const bar = $("[data-bar]", body);
    const log = $("[data-log]", body);
    progress.hidden = false;
    let ok = 0;
    let skipped = 0;
    let failed = 0;
    for (let i = 0; i < sheet.rows.length; i++) {
      try {
        let input = rowToInput(tab, sheet.rows[i], mapping);
        const title = input[kind.titleField];
        if (!title) {
          skipped += 1;
          continue;
        }
        if (enrichOn) input = await enrich(kindKey, input);
        const slug = kind.plain ? slugify(title) || `item-${i}` : await uniqueSlug(kindKey, title, input.tmdbId, input.year);
        const snap = await getDoc(doc(db, kind.col, slug));
        if (snap.exists() && !overwrite) {
          skipped += 1;
        } else {
          const existing = snap.exists() ? { id: slug, ...snap.data() } : null;
          if (!kind.plain) input.status = publish ? "published" : existing ? existing.status : "draft";
          await saveDoc(kindKey, slug, input, { existing });
          ok += 1;
        }
      } catch (error) {
        failed += 1;
        log.textContent = `Última falha (linha ${i + 2}): ${error.message}`;
      }
      bar.style.width = `${Math.round(((i + 1) / sheet.rows.length) * 100)}%`;
    }
    setBusy(button, false);
    toast(`Importação concluída: ${ok} criado(s)/atualizado(s), ${skipped} pulado(s), ${failed} com erro.`, failed ? "error" : "info");
    onDone?.();
  }

  (async () => {
    try {
      sheet = await workerApi(`/sheets/${tab}`);
      mapping = autoMap(tab, sheet.columns);
      renderMapping();
    } catch (error) {
      body.innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
    }
  })();
  return modal;
}
