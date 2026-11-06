import { db } from "../firebase.js";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { esc, slugify } from "../lib/util.js";
import { $, $$, toast, openModal, confirmBox, fieldHtml, readForm, formatTs, setBusy, emptyState } from "../lib/ui.js";
import { KINDS, buildDoc } from "../lib/schema.js";
import { PANEL_CONFIG } from "../config.js";
import { workerApi } from "../lib/api.js";
import { openTmdbImport } from "./import-tmdb.js";
import { openSheetImport } from "./import-sheet.js";

export async function uniqueSlug(kindKey, base, tmdbId, year) {
  const kind = KINDS[kindKey];
  let slug = slugify(base) || "item";
  const candidates = [slug, year ? `${slug}-${year}` : null, ...[2, 3, 4, 5].map((n) => `${slug}-${n}`)].filter(Boolean);
  for (const candidate of candidates) {
    const snap = await getDoc(doc(db, kind.col, candidate));
    if (!snap.exists()) return candidate;
    if (tmdbId && snap.data().tmdbId === tmdbId) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export async function saveDoc(kindKey, slug, input, { existing = null, merge = true } = {}) {
  const kind = KINDS[kindKey];
  const built = buildDoc(kindKey, input, existing);
  const payload = { ...built, slug, updatedAt: serverTimestamp() };
  if (!existing) payload.createdAt = serverTimestamp();
  if (kind.dated && payload.status === "published" && !payload.publishedAt) payload.publishedAt = serverTimestamp();
  await setDoc(doc(db, kind.col, slug), payload, { merge });
  return payload;
}

function rowCells(kind, item) {
  return kind.columns.map((c) => `<td>${esc(c.get(item))}</td>`).join("");
}

function statusBadge(status) {
  return status === "published" ? `<span class="badge badge-ok">Publicado</span>` : `<span class="badge">Rascunho</span>`;
}

export async function mountCrud(kindKey, root, actionsRoot) {
  const kind = KINDS[kindKey];
  let items = [];
  let selected = new Set();

  actionsRoot.innerHTML = `
    <button type="button" class="btn btn-primary btn-sm" data-new>Adicionar ${esc(kind.singular)}</button>
    ${kind.tmdb ? `<button type="button" class="btn btn-secondary btn-sm" data-tmdb>Importar do TMDB</button>` : ""}
    ${kind.sheet ? `<button type="button" class="btn btn-secondary btn-sm" data-sheet>Importar da planilha</button>` : ""}`;

  root.innerHTML = `
    <div class="toolbar">
      <input type="search" class="search" placeholder="Filtrar por nome..." aria-label="Filtrar lista" data-filter>
      ${kind.plain ? "" : `<select data-status aria-label="Filtrar por situação"><option value="">Todas as situações</option><option value="published">Publicados</option><option value="draft">Rascunhos</option></select>`}
      <span class="muted" data-count></span>
    </div>
    <div class="bulkbar" data-bulk hidden>
      <span data-bulk-count></span>
      ${kind.plain ? "" : `<button type="button" class="btn btn-secondary btn-sm" data-bulk-publish>Publicar</button><button type="button" class="btn btn-secondary btn-sm" data-bulk-draft>Voltar para rascunho</button>`}
      <button type="button" class="btn btn-danger btn-sm" data-bulk-delete>Excluir</button>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th class="check-col"><input type="checkbox" data-all aria-label="Selecionar todos"></th>${kind.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}${kind.plain ? "" : "<th>Situação</th>"}<th>Atualizado</th><th></th></tr></thead>
      <tbody data-rows></tbody>
    </table></div>
    <div data-empty></div>`;

  const rowsEl = $("[data-rows]", root);
  const emptyEl = $("[data-empty]", root);

  async function load() {
    rowsEl.innerHTML = `<tr><td colspan="9" class="muted">Carregando...</td></tr>`;
    try {
      const order = kind.plain ? "order" : "updatedAt";
      const dir = kind.plain ? "asc" : "desc";
      const snap = await getDocs(query(collection(db, kind.col), orderBy(order, dir), limit(300)));
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      rowsEl.innerHTML = "";
      emptyEl.innerHTML = emptyState(`Não foi possível carregar: ${error.message}`);
      return;
    }
    selected = new Set();
    render();
  }

  function visible() {
    const text = $("[data-filter]", root).value.trim().toLowerCase();
    const status = kind.plain ? "" : $("[data-status]", root).value;
    return items.filter((i) => {
      const title = String(i[kind.titleField] || "").toLowerCase();
      return (!text || title.includes(text)) && (!status || i.status === status);
    });
  }

  function render() {
    const list = visible();
    $("[data-count]", root).textContent = `${list.length} de ${items.length}`;
    emptyEl.innerHTML = list.length ? "" : emptyState(items.length ? "Nada encontrado com esse filtro." : `Nada cadastrado aqui ainda. Use “Adicionar ${kind.singular}” ou importe.`);
    rowsEl.innerHTML = list
      .map((item) => {
        const live = kind.publicPath && item.status === "published" && PANEL_CONFIG.siteUrl;
        return `<tr data-id="${esc(item.id)}">
          <td class="check-col"><input type="checkbox" data-select="${esc(item.id)}"${selected.has(item.id) ? " checked" : ""} aria-label="Selecionar"></td>
          ${rowCells(kind, item)}
          ${kind.plain ? "" : `<td>${statusBadge(item.status)}</td>`}
          <td class="muted">${esc(formatTs(item.updatedAt))}</td>
          <td class="row-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit="${esc(item.id)}">Editar</button>
            ${live ? `<a class="btn btn-ghost btn-sm" href="${esc(PANEL_CONFIG.siteUrl.replace(/\/+$/, ""))}${kind.publicPath}${esc(item.id)}" target="_blank" rel="noopener">Ver no site</a>` : ""}
          </td></tr>`;
      })
      .join("");
    const bulk = $("[data-bulk]", root);
    bulk.hidden = selected.size === 0;
    $("[data-bulk-count]", root).textContent = `${selected.size} selecionado(s)`;
  }

  function openForm(item = null) {
    const form = document.createElement("form");
    form.className = "form-grid";
    form.noValidate = true;
    const values = item || {};
    form.innerHTML = `${kind.fields.map((f) => fieldHtml(f, f.type === "select" && f.name === "status" ? values.status || "draft" : values[f.name])).join("")}
      <div class="form-foot"><p class="form-error" data-error role="alert"></p>
        <div class="row-end">${item ? `<button type="button" class="btn btn-danger" data-delete>Excluir</button>` : ""}<button type="submit" class="btn btn-primary">${item ? "Salvar alterações" : `Criar ${esc(kind.singular)}`}</button></div></div>`;
    const modal = openModal({ title: item ? `Editar ${kind.singular}` : `Adicionar ${kind.singular}`, body: form, wide: true });

    form.addEventListener("click", async (event) => {
      const aiBtn = event.target.closest("[data-ai]");
      if (aiBtn) {
        const target = form.elements[aiBtn.dataset.target];
        const title = form.elements[kind.titleField]?.value || "";
        const prompt = target.value.trim() || `Escreva sobre: ${title}`;
        const context = [`Título: ${title}`, form.elements.genres ? `Gêneros: ${form.elements.genres.value}` : "", form.elements.director ? `Direção: ${form.elements.director.value}` : "", form.elements.year ? `Ano: ${form.elements.year.value}` : ""].filter(Boolean).join("\n");
        setBusy(aiBtn, true, "Gerando...");
        try {
          const result = await workerApi("/gemini/generate", { method: "POST", body: { task: aiBtn.dataset.ai, prompt, context } });
          target.value = result.text;
          toast("Texto gerado. Revise antes de publicar.");
        } catch (error) {
          toast(error.message, "error");
        } finally {
          setBusy(aiBtn, false);
        }
      }
      if (event.target.closest("[data-delete]")) {
        if (!(await confirmBox(`Excluir “${item[kind.titleField]}”? Isso não pode ser desfeito.`, "Excluir", true))) return;
        try {
          await deleteDoc(doc(db, kind.col, item.id));
          toast("Excluído.");
          modal.close();
          load();
        } catch (error) {
          toast(error.message, "error");
        }
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorEl = $("[data-error]", form);
      errorEl.textContent = "";
      const submit = $("button[type=submit]", form);
      try {
        const input = readForm(kind.fields, form);
        setBusy(submit, true, "Salvando...");
        const slug = item ? item.id : await uniqueSlug(kindKey, input[kind.titleField], input.tmdbId, input.year);
        await saveDoc(kindKey, slug, input, { existing: item });
        toast(item ? "Alterações salvas." : "Cadastro criado.");
        modal.close();
        load();
      } catch (error) {
        errorEl.textContent = error.message;
      } finally {
        setBusy(submit, false);
      }
    });
  }

  async function bulk(action) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === "delete" && !(await confirmBox(`Excluir ${ids.length} item(ns)? Isso não pode ser desfeito.`, "Excluir", true))) return;
    let done = 0;
    for (const id of ids) {
      try {
        if (action === "delete") await deleteDoc(doc(db, kind.col, id));
        else {
          const patch = { status: action === "publish" ? "published" : "draft", updatedAt: serverTimestamp() };
          const current = items.find((i) => i.id === id);
          if (kind.dated && action === "publish" && !current.publishedAt) patch.publishedAt = serverTimestamp();
          await updateDoc(doc(db, kind.col, id), patch);
        }
        done += 1;
      } catch (error) {
        toast(`Falhou em ${id}: ${error.message}`, "error");
      }
    }
    toast(`${done} item(ns) atualizado(s).`);
    load();
  }

  actionsRoot.addEventListener("click", (event) => {
    if (event.target.closest("[data-new]")) openForm();
    if (event.target.closest("[data-tmdb]")) openTmdbImport(kindKey, load);
    if (event.target.closest("[data-sheet]")) openSheetImport(kindKey, load);
  });

  root.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    if (edit) openForm(items.find((i) => i.id === edit.dataset.edit));
    if (event.target.closest("[data-bulk-publish]")) bulk("publish");
    if (event.target.closest("[data-bulk-draft]")) bulk("draft");
    if (event.target.closest("[data-bulk-delete]")) bulk("delete");
  });

  root.addEventListener("change", (event) => {
    const one = event.target.closest("[data-select]");
    if (one) {
      one.checked ? selected.add(one.dataset.select) : selected.delete(one.dataset.select);
      render();
    }
    if (event.target.matches("[data-all]")) {
      selected = event.target.checked ? new Set(visible().map((i) => i.id)) : new Set();
      render();
    }
    if (event.target.matches("[data-status]")) render();
  });
  $("[data-filter]", root).addEventListener("input", render);

  await load();
}
