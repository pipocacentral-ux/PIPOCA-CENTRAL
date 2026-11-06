import { onAuth, state, api, toast, openAuthModal, auth } from "../app.js";
import { signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { loadUserList, loadMyRatings, loadAvatars, saveProfile, getProfile } from "../user.js";
import { cardTitle } from "../shared/cards.js";
import { esc, formatDateBR } from "../shared/util.js";

const gate = document.getElementById("profile-gate");
const app = document.getElementById("profile-app");
const sub = document.getElementById("profile-sub");
const tabs = [...document.querySelectorAll("[data-tab]")];
const panes = {
  favoritos: document.getElementById("pane-favoritos"),
  depois: document.getElementById("pane-depois"),
  notas: document.getElementById("pane-notas"),
  conta: document.getElementById("pane-conta"),
};
const loaded = new Set();

function showTab(name) {
  const key = panes[name] ? name : "favoritos";
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === key));
  Object.entries(panes).forEach(([k, el]) => (el.hidden = k !== key));
  if (location.hash !== `#${key}`) history.replaceState(null, "", `#${key}`);
  loadPane(key);
}

function empty(text, cta) {
  return `<div class="empty-state"><h3>${esc(text)}</h3>${cta ? `<a class="btn btn-primary" href="/busca">Explorar filmes e séries</a>` : ""}</div>`;
}

async function loadPane(key) {
  if (loaded.has(key) || !state.user) return;
  loaded.add(key);
  const uid = state.user.uid;
  try {
    if (key === "favoritos" || key === "depois") {
      const items = await loadUserList(uid, key === "favoritos" ? "favorites" : "watchlist");
      const el = panes[key];
      el.innerHTML = items.length
        ? `<div class="card-grid">${items.map(cardTitle).join("")}</div>`
        : empty(key === "favoritos" ? "Você ainda não favoritou nada" : "Sua lista de “Assistir depois” está vazia", true);
      window.hydrateIcons?.(el);
    }
    if (key === "notas") {
      const items = await loadMyRatings(uid);
      panes.notas.innerHTML = items.length
        ? `<div class="card-grid">${items.map((r) => `<div>${cardTitle(r)}<div class="meta" style="font-size:var(--fs-xs); color:var(--color-brand); margin-top:2px">Sua nota: ${esc(r.value)}/5</div></div>`).join("")}</div>`
        : empty("Você ainda não avaliou nada", true);
      window.hydrateIcons?.(panes.notas);
    }
    if (key === "conta") await renderAccount();
  } catch {
    loaded.delete(key);
    panes[key].innerHTML = empty("Não foi possível carregar agora. Tente de novo em instantes.", false);
  }
}

async function renderAccount() {
  const user = state.user;
  const profile = (await getProfile(user.uid)) || {};
  let avatars = [];
  try {
    avatars = await loadAvatars();
  } catch {
    avatars = [];
  }
  const current = profile.avatarUrl || "";
  const options = [];
  if (user.photoURL) options.push({ id: "google", name: "Foto do Google", url: user.photoURL });
  avatars.forEach((a) => options.push({ id: a.id, name: a.name || "Avatar", url: a.url }));
  const grid = options.length
    ? `<div class="avatar-grid" role="radiogroup" aria-label="Escolha seu avatar">${options
        .map(
          (o) => `<label class="avatar-option"><input type="radio" name="avatar" value="${esc(o.url)}"${o.url === current ? " checked" : ""}><img src="${esc(o.url)}" alt="${esc(o.name)}" width="64" height="64" loading="lazy" referrerpolicy="no-referrer"></label>`
        )
        .join("")}</div>`
    : `<p class="field-hint">Os avatares para escolher chegam em breve.</p>`;
  const created = profile.createdAt && profile.createdAt.toDate ? formatDateBR(profile.createdAt.toDate().toISOString()) : "";

  panes.conta.innerHTML = `
    <form class="panel" id="profile-form" style="max-width:640px">
      <h2 style="font-size:var(--fs-lg); margin-bottom:var(--space-4)">Seu perfil</h2>
      <div class="field"><label for="p-name">Nome de exibição</label><input id="p-name" name="name" maxlength="40" value="${esc(profile.displayName || user.displayName || "")}" required></div>
      <div class="field"><span style="font-size:var(--fs-sm); font-weight:600">Avatar</span>${grid}</div>
      <p class="form-error" data-error role="alert"></p>
      <button type="submit" class="btn btn-primary">Salvar alterações</button>
      <p class="field-hint" style="margin-top:var(--space-3)">E-mail: ${esc(user.email || "—")}${user.emailVerified ? " (confirmado)" : " (não confirmado)"}${created ? ` · Conta criada em ${esc(created)}` : ""}</p>
    </form>
    <div class="panel" style="max-width:640px; margin-top:var(--space-5)">
      <h2 style="font-size:var(--fs-lg); margin-bottom:var(--space-3)">Seus dados (LGPD)</h2>
      <p style="font-size:var(--fs-sm)">Você pode baixar uma cópia do que guardamos sobre você ou excluir sua conta. A exclusão remove perfil, favoritos, lista de assistir depois, notas e comentários, e não dá para desfazer.</p>
      <div style="display:flex; gap:var(--space-3); flex-wrap:wrap; margin-top:var(--space-4)">
        <button type="button" class="btn btn-secondary" id="export-data">Baixar meus dados</button>
        <button type="button" class="btn btn-secondary" id="delete-account" style="color:var(--color-error); border-color:var(--color-error)"><span class="icon" data-icon="trash"></span> Excluir minha conta</button>
      </div>
    </div>`;
  window.hydrateIcons?.(panes.conta);

  const form = document.getElementById("profile-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = form.name.value.trim();
    const error = form.querySelector("[data-error]");
    error.textContent = "";
    if (name.length < 2) {
      error.textContent = "Escolha um nome com pelo menos 2 letras.";
      return;
    }
    const picked = form.querySelector('input[name="avatar"]:checked');
    const url = picked ? picked.value : "";
    if (url && !url.startsWith("https://")) {
      error.textContent = "Esse avatar não é válido.";
      return;
    }
    try {
      await saveProfile(user.uid, { displayName: name, avatarUrl: url });
      state.profile = await getProfile(user.uid);
      toast("Perfil atualizado.");
      location.reload();
    } catch {
      error.textContent = "Não foi possível salvar agora. Tente de novo.";
    }
  });

  document.getElementById("export-data").addEventListener("click", async () => {
    try {
      const data = await api("exportData");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "meus-dados-pipocacentral.json";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast(error.message);
    }
  });

  document.getElementById("delete-account").addEventListener("click", async () => {
    const typed = prompt("Para excluir sua conta de forma definitiva, digite EXCLUIR:");
    if (typed !== "EXCLUIR") return;
    try {
      await api("deleteAccount", { confirm: "EXCLUIR" });
      await signOut(auth);
      toast("Sua conta foi excluída.");
      setTimeout(() => (location.href = "/"), 1200);
    } catch (error) {
      toast(error.message);
    }
  });
}

tabs.forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
window.addEventListener("hashchange", () => state.user && showTab(location.hash.slice(1)));

document.getElementById("gate-login")?.addEventListener("click", () => openAuthModal("login"));

onAuth((user) => {
  loaded.clear();
  if (!user) {
    gate.hidden = false;
    app.hidden = true;
    sub.textContent = "Entre para ver seus favoritos, notas e configurações.";
    return;
  }
  gate.hidden = true;
  app.hidden = false;
  sub.textContent = `Olá, ${(state.profile && state.profile.displayName) || user.displayName || "cinéfilo(a)"}!`;
  showTab(location.hash.slice(1));
});
