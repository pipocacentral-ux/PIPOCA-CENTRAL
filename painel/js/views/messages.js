import { db } from "../firebase.js";
import { collection, doc, getDocs, updateDoc, deleteDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { esc } from "../lib/util.js";
import { $, toast, confirmBox, openModal, formatTs, emptyState, setBusy } from "../lib/ui.js";
import { adminApi } from "../lib/api.js";

const LABEL = { new: "Nova", read: "Lida", replied: "Respondida" };

export async function mountMessages(root) {
  let items = [];
  root.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Quando</th><th>De</th><th>Assunto</th><th>Situação</th><th></th></tr></thead><tbody data-rows></tbody></table></div><div data-empty></div>`;

  async function load() {
    try {
      const snap = await getDocs(query(collection(db, "contactMessages"), orderBy("createdAt", "desc"), limit(100)));
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      $("[data-empty]", root).innerHTML = emptyState(`Não foi possível carregar: ${error.message}`);
      return;
    }
    $("[data-empty]", root).innerHTML = items.length ? "" : emptyState("Nenhuma mensagem por enquanto.");
    $("[data-rows]", root).innerHTML = items
      .map((m) => `<tr class="${m.status === "new" ? "is-unread" : ""}"><td class="muted">${esc(formatTs(m.createdAt))}</td><td>${esc(m.name)}<div class="muted">${esc(m.email)}</div></td><td>${esc(m.subject)}</td><td><span class="badge${m.status === "new" ? " badge-warn" : m.status === "replied" ? " badge-ok" : ""}">${esc(LABEL[m.status] || m.status)}</span></td><td class="row-actions"><button type="button" class="btn btn-ghost btn-sm" data-open="${esc(m.id)}">Abrir</button></td></tr>`)
      .join("");
  }

  function open(message) {
    const body = document.createElement("div");
    body.innerHTML = `
      <p class="muted">${esc(message.name)} · ${esc(message.email)} · ${esc(formatTs(message.createdAt))}</p>
      <p class="muted">Assunto: ${esc(message.subject)}</p>
      <div class="message-text">${esc(message.message)}</div>
      ${message.replyText ? `<h3 class="h3">Resposta enviada</h3><div class="message-text">${esc(message.replyText)}</div>` : ""}
      <form data-reply class="reply-form">
        <div class="field"><label for="reply-text">Responder por e-mail</label><textarea id="reply-text" rows="6" required minlength="3"></textarea></div>
        <p class="form-error" data-error role="alert"></p>
        <div class="row-end">
          <button type="button" class="btn btn-danger" data-delete>Excluir</button>
          <a class="btn btn-secondary" href="mailto:${esc(message.email)}?subject=${encodeURIComponent(`Re: ${message.subject}`)}">Abrir no meu e-mail</a>
          <button type="submit" class="btn btn-primary">Enviar resposta</button>
        </div>
      </form>`;
    const modal = openModal({ title: "Mensagem de contato", body, wide: true });
    if (message.status === "new") updateDoc(doc(db, "contactMessages", message.id), { status: "read" }).then(load).catch(() => {});

    $("[data-reply]", body).addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = $("button[type=submit]", body);
      const errorEl = $("[data-error]", body);
      errorEl.textContent = "";
      setBusy(submit, true, "Enviando...");
      try {
        await adminApi("replyMessage", { id: message.id, text: $("#reply-text", body).value });
        toast("Resposta enviada.");
        modal.close();
        load();
      } catch (error) {
        errorEl.textContent = error.message;
      } finally {
        setBusy(submit, false);
      }
    });
    $("[data-delete]", body).addEventListener("click", async () => {
      if (!(await confirmBox("Excluir esta mensagem?", "Excluir", true))) return;
      await deleteDoc(doc(db, "contactMessages", message.id));
      modal.close();
      load();
    });
  }

  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-open]");
    if (btn) open(items.find((m) => m.id === btn.dataset.open));
  });
  await load();
}
