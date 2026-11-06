import { auth } from "./firebase.js";
import {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { esc } from "./lib/util.js";
import { $, $$, toast } from "./lib/ui.js";
import { adminApi } from "./lib/api.js";
import { mountDashboard } from "./views/dashboard.js";
import { mountCrud } from "./views/crud.js";
import { mountComments } from "./views/comments.js";
import { mountMessages } from "./views/messages.js";
import { mountTeam } from "./views/team.js";
import { mountAssistant } from "./views/assistant.js";

const ROUTES = [
  { path: "/", title: "Início", group: "Geral", mount: (root) => mountDashboard(root) },
  { path: "/filmes", title: "Filmes", group: "Catálogo", crud: "movies" },
  { path: "/series", title: "Séries", group: "Catálogo", crud: "series" },
  { path: "/elenco", title: "Elenco", group: "Catálogo", crud: "people" },
  { path: "/noticias", title: "Notícias", group: "Conteúdo", crud: "news" },
  { path: "/analises", title: "Análises", group: "Conteúdo", crud: "reviews" },
  { path: "/listas", title: "Listas", group: "Conteúdo", crud: "lists" },
  { path: "/comentarios", title: "Comentários", group: "Comunidade", mount: (root) => mountComments(root) },
  { path: "/mensagens", title: "Mensagens de contato", group: "Comunidade", mount: (root) => mountMessages(root) },
  { path: "/plataformas", title: "Plataformas", group: "Dados do site", crud: "platforms" },
  { path: "/avatares", title: "Avatares", group: "Dados do site", crud: "avatars" },
  { path: "/assistente", title: "Assistente de IA", group: "Ferramentas", mount: (root) => mountAssistant(root) },
  { path: "/equipe", title: "Equipe e usuários", group: "Ferramentas", mount: (root, ctx) => mountTeam(root, ctx) },
];

const el = {
  boot: $("#boot"), login: $("#login"), denied: $("#denied"), shell: $("#shell"),
  view: $("#view"), title: $("#view-title"), actions: $("#view-actions"), nav: $("#nav"), who: $("#who"),
};

let session = { role: null, uid: null };

function show(name) {
  el.boot.hidden = true;
  el.login.hidden = name !== "login";
  el.denied.hidden = name !== "denied";
  el.shell.hidden = name !== "shell";
}

function renderNav() {
  const groups = [...new Set(ROUTES.map((r) => r.group))];
  el.nav.innerHTML = groups
    .map((g) => `<div class="nav-group"><div class="nav-label">${esc(g)}</div>${ROUTES.filter((r) => r.group === g).map((r) => `<a href="#${r.path}" data-path="${r.path}">${esc(r.title)}</a>`).join("")}</div>`)
    .join("");
}

function freshen(key) {
  const next = el[key].cloneNode(false);
  el[key].replaceWith(next);
  el[key] = next;
}

function closeMenu() {
  $("#sidebar").classList.remove("is-open");
  $("#scrim").classList.remove("is-open");
}

async function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  const found = ROUTES.find((r) => r.path === path) || ROUTES[0];
  $$("#nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.path === found.path));
  el.title.textContent = found.title;
  document.title = `${found.title} | Painel PipocaCentral`;
  freshen("actions");
  freshen("view");
  closeMenu();
  try {
    if (found.crud) await mountCrud(found.crud, el.view, el.actions);
    else await found.mount(el.view, session);
  } catch (error) {
    el.view.innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
  }
  el.view.focus({ preventScroll: true });
}

async function enter(user) {
  try {
    const result = await adminApi("bootstrap");
    if (result.refresh) await user.getIdToken(true);
    if (!result.role) {
      $("#denied-text").textContent = `A conta ${user.email} não tem permissão para usar o painel. Peça ao administrador geral para adicionar esse e-mail na equipe.`;
      return show("denied");
    }
    session = { role: result.role, uid: user.uid };
    el.who.innerHTML = `<strong>${esc(user.displayName || user.email)}</strong><span class="muted">${result.role === "super" ? "Administrador geral" : "Administrador"}</span>`;
    renderNav();
    show("shell");
    route();
  } catch (error) {
    $("#denied-text").textContent = `Não foi possível validar seu acesso: ${error.message}`;
    show("denied");
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    session = { role: null, uid: null };
    return show("login");
  }
  enter(user);
});

window.addEventListener("hashchange", () => !el.shell.hidden && route());

$("#login-google").addEventListener("click", async () => {
  $("#login-error").textContent = "";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    $("#login-error").textContent = error.code === "auth/unauthorized-domain"
      ? "Este endereço ainda não está nos domínios autorizados do Firebase (Authentication > Configurações)."
      : "Não foi possível entrar com o Google. Tente de novo.";
  }
});

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#login-error").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
  } catch (error) {
    $("#login-error").textContent = error.code === "auth/too-many-requests" ? "Muitas tentativas. Espere um pouco." : "E-mail ou senha incorretos.";
  }
});

const logout = async () => {
  await signOut(auth);
  toast("Você saiu do painel.");
};
$("#logout").addEventListener("click", logout);
$("#denied-logout").addEventListener("click", logout);
$("#menu-open").addEventListener("click", () => {
  $("#sidebar").classList.add("is-open");
  $("#scrim").classList.add("is-open");
});
$("#menu-close").addEventListener("click", closeMenu);
$("#scrim").addEventListener("click", closeMenu);
