import { esc } from "../lib/util.js";
import { $, toast, confirmBox, setBusy, emptyState } from "../lib/ui.js";
import { adminApi } from "../lib/api.js";

function fmt(value) {
  const t = value && value._seconds ? new Date(value._seconds * 1000) : value ? new Date(value) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString("pt-BR") : "";
}

export async function mountTeam(root, { role, uid }) {
  const isSuper = role === "super";
  root.innerHTML = `
    <section><h2 class="h2">Administradores</h2>
      ${isSuper ? `<form class="inline-form" data-invite><input type="email" placeholder="e-mail da pessoa" aria-label="E-mail do novo administrador" required><button type="submit" class="btn btn-primary btn-sm">Adicionar administrador</button></form>
      <p class="muted">Se a pessoa já tem conta no site, o acesso é liberado na hora. Se não tiver, o convite fica esperando e vale assim que ela entrar no painel com esse e-mail.</p>` : `<p class="muted">Só o administrador geral pode adicionar ou remover administradores.</p>`}
      <div data-admins class="panel-box"><p class="muted">Carregando...</p></div></section>
    <section><h2 class="h2">Usuários do site</h2><div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Entrou em</th><th>Último acesso</th><th>Situação</th><th></th></tr></thead><tbody data-users></tbody></table></div>
      <div class="row-center"><button type="button" class="btn btn-secondary btn-sm" data-more hidden>Carregar mais</button></div></section>`;

  async function loadAdmins() {
    const box = $("[data-admins]", root);
    try {
      const data = await adminApi("listAdmins");
      const rows = data.admins.map((a) => `<li><div><strong>${esc(a.displayName || a.email)}</strong> <span class="badge${a.role === "super" ? " badge-ok" : ""}">${a.role === "super" ? "Administrador geral" : "Administrador"}</span><div class="muted">${esc(a.email)}</div></div>
        ${isSuper && a.role !== "super" && a.uid !== uid ? `<button type="button" class="btn btn-danger btn-sm" data-remove="${esc(a.uid)}" data-email="${esc(a.email)}">Remover</button>` : ""}</li>`);
      const invites = data.invites.map((i) => `<li><div><strong>${esc(i.email)}</strong> <span class="badge badge-warn">Convite pendente</span></div>${isSuper ? `<button type="button" class="btn btn-secondary btn-sm" data-cancel="${esc(i.email)}">Cancelar convite</button>` : ""}</li>`);
      box.innerHTML = `<ul class="list-rows">${[...rows, ...invites].join("")}</ul>`;
    } catch (error) {
      box.innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
    }
  }

  let nextToken = null;
  async function loadUsers(more) {
    const tbody = $("[data-users]", root);
    if (!more) tbody.innerHTML = `<tr><td colspan="6" class="muted">Carregando...</td></tr>`;
    try {
      const data = await adminApi("listUsers", { pageToken: more ? nextToken : undefined });
      nextToken = data.nextPageToken;
      const html = data.users.map((u) => `<tr><td>${esc(u.displayName || "—")}</td><td>${esc(u.email)}${u.verified ? "" : ` <span class="badge">não confirmado</span>`}</td><td class="muted">${esc(fmt(u.createdAt))}</td><td class="muted">${esc(fmt(u.lastSignIn))}</td><td>${u.disabled ? `<span class="badge badge-bad">Suspenso</span>` : u.isAdmin ? `<span class="badge badge-ok">Admin</span>` : `<span class="badge">Ativo</span>`}</td>
        <td class="row-actions">${u.isAdmin || u.uid === uid ? "" : `<button type="button" class="btn btn-ghost btn-sm" data-disable="${esc(u.uid)}" data-state="${u.disabled}">${u.disabled ? "Reativar" : "Suspender"}</button>`}</td></tr>`).join("");
      if (more) tbody.insertAdjacentHTML("beforeend", html);
      else tbody.innerHTML = html || `<tr><td colspan="6">${emptyState("Nenhum usuário ainda.")}</td></tr>`;
      $("[data-more]", root).hidden = !nextToken;
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="6" class="form-error">${esc(error.message)}</td></tr>`;
    }
  }

  $("[data-invite]", root)?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input");
    const button = event.currentTarget.querySelector("button");
    setBusy(button, true, "Adicionando...");
    try {
      const result = await adminApi("addAdmin", { email: input.value });
      toast(result.status === "granted" ? "Acesso liberado." : "Convite criado. Vale quando a pessoa entrar com esse e-mail.");
      if (!result.mailSent) toast(`O aviso por e-mail não foi enviado (${result.mailError || "sem configuração"}). Avise a pessoa por outro meio.`, "error");
      input.value = "";
      loadAdmins();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(button, false);
    }
  });

  root.addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-remove]");
    const cancel = event.target.closest("[data-cancel]");
    const disable = event.target.closest("[data-disable]");
    try {
      if (remove) {
        if (!(await confirmBox(`Remover o acesso de ${remove.dataset.email}?`, "Remover acesso", true))) return;
        await adminApi("removeAdmin", { uid: remove.dataset.remove });
        toast("Acesso removido.");
        loadAdmins();
      }
      if (cancel) {
        await adminApi("cancelInvite", { email: cancel.dataset.cancel });
        toast("Convite cancelado.");
        loadAdmins();
      }
      if (disable) {
        const suspend = disable.dataset.state !== "true";
        if (suspend && !(await confirmBox("Suspender esta conta? A pessoa não conseguirá entrar no site.", "Suspender", true))) return;
        await adminApi("setUserDisabled", { uid: disable.dataset.disable, disabled: suspend });
        toast(suspend ? "Conta suspensa." : "Conta reativada.");
        loadUsers(false);
      }
    } catch (error) {
      toast(error.message, "error");
    }
    if (event.target.closest("[data-more]")) loadUsers(true);
  });

  await Promise.all([loadAdmins(), loadUsers(false)]);
}
