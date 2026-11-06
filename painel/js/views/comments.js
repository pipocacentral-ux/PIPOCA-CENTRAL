import { db } from "../firebase.js";
import { collection, doc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { esc } from "../lib/util.js";
import { $, toast, confirmBox, formatTs, emptyState } from "../lib/ui.js";
import { PANEL_CONFIG } from "../config.js";

const FILTERS = [
  ["pending", "Em revisão"],
  ["flagged", "Denunciados"],
  ["hidden", "Ocultos"],
  ["visible", "Publicados"],
];

export async function mountComments(root) {
  let status = "pending";
  root.innerHTML = `<div class="toolbar">${FILTERS.map(([v, l]) => `<button type="button" class="chip${v === status ? " is-active" : ""}" data-filter="${v}">${l}</button>`).join("")}</div><div data-list></div>`;
  const list = $("[data-list]", root);

  async function load() {
    list.innerHTML = `<p class="muted">Carregando...</p>`;
    try {
      const snap = await getDocs(query(collection(db, "comments"), where("status", "==", status), orderBy("createdAt", "desc"), limit(60)));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.innerHTML = items.length
        ? items.map((c) => {
            const path = c.targetType === "series" ? "/series/" : "/filmes/";
            const link = PANEL_CONFIG.siteUrl ? `<a href="${esc(PANEL_CONFIG.siteUrl.replace(/\/+$/, ""))}${path}${esc(c.targetSlug)}" target="_blank" rel="noopener">${esc(c.targetSlug)}</a>` : esc(c.targetSlug);
            return `<article class="comment-card" data-id="${esc(c.id)}">
              <div class="comment-meta"><strong>${esc(c.displayName)}</strong><span class="muted">em ${link} · ${esc(formatTs(c.createdAt))}${c.reports ? ` · ${c.reports} denúncia(s)` : ""}</span></div>
              <p class="comment-text">${esc(c.text)}</p>
              <div class="row-actions">
                ${status !== "visible" ? `<button type="button" class="btn btn-primary btn-sm" data-act="visible">Aprovar</button>` : ""}
                ${status !== "hidden" ? `<button type="button" class="btn btn-secondary btn-sm" data-act="hidden">Ocultar</button>` : ""}
                <button type="button" class="btn btn-danger btn-sm" data-act="delete">Excluir</button>
              </div></article>`;
          }).join("")
        : emptyState("Nenhum comentário nessa lista.");
    } catch (error) {
      list.innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
    }
  }

  root.addEventListener("click", async (event) => {
    const chip = event.target.closest("[data-filter]");
    if (chip) {
      status = chip.dataset.filter;
      root.querySelectorAll("[data-filter]").forEach((c) => c.classList.toggle("is-active", c === chip));
      load();
      return;
    }
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest("[data-id]").dataset.id;
    try {
      if (btn.dataset.act === "delete") {
        if (!(await confirmBox("Excluir este comentário de vez?", "Excluir", true))) return;
        await deleteDoc(doc(db, "comments", id));
      } else {
        await updateDoc(doc(db, "comments", id), { status: btn.dataset.act, reports: 0, reporters: [] });
      }
      toast("Pronto.");
      load();
    } catch (error) {
      toast(error.message, "error");
    }
  });
  await load();
}
