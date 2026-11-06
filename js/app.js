import { auth, startAnalytics } from "./firebase-init.js";
import {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { CONFIG } from "./config.js";
import { ensureUserDoc, getProfile, saveProfile } from "./user.js";
import { esc, initialOf } from "./shared/util.js";

export const state = { user: null, profile: null, ready: false };
const listeners = new Set();

export function toast(message) {
  if (typeof window.showToast === "function") window.showToast(message);
}

export function onAuth(callback) {
  listeners.add(callback);
  if (state.ready) callback(state.user, state.profile);
  return () => listeners.delete(callback);
}

export async function api(action, payload = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  let response;
  try {
    response = await fetch("/api/action", { method: "POST", headers, body: JSON.stringify({ action, ...payload }) });
  } catch {
    const error = new Error("Sem conexão. Verifique sua internet e tente de novo.");
    error.code = "network";
    throw error;
  }
  const data = await response.json().catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || "Algo deu errado");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

const AUTH_ERRORS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Esse e-mail não parece válido.",
  "auth/email-already-in-use": "Esse e-mail já tem conta. Entre ou use “Esqueci minha senha”.",
  "auth/weak-password": "Use uma senha com pelo menos 8 caracteres.",
  "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo.",
  "auth/popup-closed-by-user": "A janela do Google foi fechada antes de terminar.",
  "auth/cancelled-popup-request": "",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Libere pop-ups para este site.",
  "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  "auth/user-disabled": "Esta conta foi suspensa. Fale com a gente pelo Contato.",
  "auth/account-exists-with-different-credential": "Já existe uma conta com esse e-mail usando outro método de login.",
  "auth/unauthorized-domain": "Este endereço ainda não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).",
  "auth/operation-not-allowed": "Esse método de login não está ativado no Firebase.",
};

function authMessage(error) {
  if (error && error.code in AUTH_ERRORS) return AUTH_ERRORS[error.code];
  return "Não foi possível concluir. Tente de novo em instantes.";
}

let modal = null;
let lastFocus = null;
let mode = "login";

function buildModal() {
  const el = document.createElement("div");
  el.className = "modal";
  el.id = "auth-modal";
  el.hidden = true;
  el.innerHTML = `
    <div class="modal-scrim" data-close></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button class="icon-btn modal-close" data-close aria-label="Fechar"><span class="icon" data-icon="close"></span></button>
      <h2 id="auth-title" style="font-size:var(--fs-xl)">Entrar</h2>
      <p class="modal-sub" data-sub>Entre para favoritar, avaliar e comentar.</p>
      <div class="filter-tabs" style="margin-block:var(--space-4)">
        <button type="button" class="filter-tab is-active" data-mode="login">Entrar</button>
        <button type="button" class="filter-tab" data-mode="signup">Criar conta</button>
      </div>
      <button type="button" class="btn btn-secondary btn-block" data-google><span class="icon" data-icon="google"></span> Continuar com o Google</button>
      <div class="divider"><span>ou com e-mail</span></div>
      <form id="auth-form" novalidate>
        <div class="field" data-signup-only hidden><label for="auth-name">Como quer ser chamado(a)</label><input id="auth-name" name="name" maxlength="40" autocomplete="nickname"></div>
        <div class="field"><label for="auth-email">E-mail</label><input id="auth-email" type="email" name="email" autocomplete="email" required></div>
        <div class="field"><label for="auth-password">Senha</label><input id="auth-password" type="password" name="password" autocomplete="current-password" minlength="8" required></div>
        <label class="check" data-signup-only hidden><input type="checkbox" name="terms"><span>Tenho ${CONFIG.minAge} anos ou mais e concordo com os <a href="/termos" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>
        <p class="form-error" role="alert" data-error></p>
        <button type="submit" class="btn btn-primary btn-block" data-submit>Entrar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-forgot style="margin-top:var(--space-2)">Esqueci minha senha</button>
      </form>
      <p class="field-hint" style="margin-top:var(--space-4)">Ao continuar com o Google você confirma ter ${CONFIG.minAge} anos ou mais e concorda com os <a href="/termos" style="color:var(--color-brand)">Termos</a> e a <a href="/privacidade" style="color:var(--color-brand)">Política de Privacidade</a>.</p>
    </div>`;
  document.body.appendChild(el);
  window.hydrateIcons?.(el);

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Tab") trapFocus(e, el.querySelector(".modal-panel"));
  });
  el.querySelectorAll("[data-mode]").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  el.querySelector("[data-google]").addEventListener("click", signInGoogle);
  el.querySelector("[data-forgot]").addEventListener("click", resetPassword);
  el.querySelector("#auth-form").addEventListener("submit", submitForm);
  return el;
}

function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll("button, a[href], input, select, textarea")].filter((n) => !n.disabled && !n.closest("[hidden]"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setError(message) {
  const box = modal.querySelector("[data-error]");
  box.textContent = message || "";
}

function setMode(next) {
  mode = next === "signup" ? "signup" : "login";
  const signup = mode === "signup";
  modal.querySelectorAll("[data-mode]").forEach((t) => t.classList.toggle("is-active", t.dataset.mode === mode));
  modal.querySelectorAll("[data-signup-only]").forEach((n) => (n.hidden = !signup));
  modal.querySelector("#auth-title").textContent = signup ? "Criar conta" : "Entrar";
  modal.querySelector("[data-submit]").textContent = signup ? "Criar minha conta" : "Entrar";
  modal.querySelector("[data-forgot]").hidden = signup;
  modal.querySelector("#auth-password").autocomplete = signup ? "new-password" : "current-password";
  modal.querySelector("[data-sub]").textContent = signup
    ? "É grátis e leva menos de um minuto."
    : "Entre para favoritar, avaliar e comentar.";
  setError("");
}

export function openAuthModal(initialMode = "login") {
  if (!modal) modal = buildModal();
  lastFocus = document.activeElement;
  setMode(initialMode);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => modal.querySelector(initialMode === "signup" ? "#auth-name" : "#auth-email").focus());
}

function closeModal() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  lastFocus?.focus?.();
}

function busy(on) {
  modal.querySelectorAll("button, input").forEach((n) => (n.disabled = on));
}

async function signInGoogle() {
  setError("");
  busy(true);
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    closeModal();
  } catch (error) {
    setError(authMessage(error));
  } finally {
    busy(false);
  }
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;
  setError("");
  if (!email || !password) return setError("Preencha e-mail e senha.");
  if (mode === "signup") {
    const name = form.name.value.trim();
    if (name.length < 2) return setError("Diga como podemos te chamar (mínimo 2 letras).");
    if (password.length < 8) return setError(AUTH_ERRORS["auth/weak-password"]);
    if (!form.terms.checked) return setError("Marque a caixa para confirmar sua idade e aceitar os termos.");
  }
  busy(true);
  try {
    if (mode === "signup") {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const chosenName = form.name.value.trim().slice(0, 40);
      await updateProfile(credential.user, { displayName: chosenName });
      await ensureUserDoc(credential.user);
      const current = await getProfile(credential.user.uid);
      await saveProfile(credential.user.uid, { displayName: chosenName, avatarUrl: (current && current.avatarUrl) || "" });
      state.profile = await getProfile(credential.user.uid);
      renderSlot();
      await sendEmailVerification(credential.user);
      toast("Conta criada! Enviamos um e-mail para você confirmar o endereço.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    closeModal();
    form.reset();
  } catch (error) {
    setError(authMessage(error));
  } finally {
    busy(false);
  }
}

async function resetPassword() {
  const email = modal.querySelector("#auth-email").value.trim();
  if (!email) return setError("Digite seu e-mail acima e clique de novo em “Esqueci minha senha”.");
  busy(true);
  try {
    await sendPasswordResetEmail(auth, email);
    setError("");
    toast("Se esse e-mail tiver conta, enviamos o link para criar uma nova senha.");
    closeModal();
  } catch (error) {
    setError(authMessage(error));
  } finally {
    busy(false);
  }
}

export function requireAuth() {
  if (auth.currentUser) return true;
  openAuthModal("login");
  return false;
}

export async function requireVerified() {
  if (!requireAuth()) return false;
  if (auth.currentUser.emailVerified) return true;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    await auth.currentUser.getIdToken(true);
    renderVerifyBanner();
    return true;
  }
  toast("Confirme seu e-mail primeiro: procure a mensagem que enviamos (veja também o spam).");
  return false;
}

function avatarHtml(user, profile) {
  const url = (profile && profile.avatarUrl) || user.photoURL || "";
  const name = (profile && profile.displayName) || user.displayName || user.email || "?";
  return url
    ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" width="36" height="36">`
    : `<span>${esc(initialOf(name))}</span>`;
}

function renderSlot() {
  document.querySelectorAll("[data-auth-slot]").forEach((slot) => {
    const user = state.user;
    if (!user) {
      slot.innerHTML = `<button class="btn btn-secondary btn-sm" data-auth-open>Entrar</button>`;
      return;
    }
    const name = (state.profile && state.profile.displayName) || user.displayName || "Minha conta";
    slot.innerHTML = `
      <div class="user-menu">
        <button class="avatar-btn" aria-haspopup="true" aria-expanded="false" aria-label="Menu da conta">${avatarHtml(user, state.profile)}</button>
        <div class="user-menu-panel" hidden>
          <div class="user-menu-name">${esc(name)}<small>${esc(user.email || "")}</small></div>
          <a href="/perfil">Meu perfil</a>
          <a href="/perfil#favoritos">Favoritos</a>
          <a href="/perfil#depois">Assistir depois</a>
          <button type="button" data-logout>Sair</button>
        </div>
      </div>`;
    const button = slot.querySelector(".avatar-btn");
    const panel = slot.querySelector(".user-menu-panel");
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    });
    slot.querySelector("[data-logout]").addEventListener("click", async () => {
      await signOut(auth);
      toast("Você saiu da conta.");
    });
  });
}

function renderVerifyBanner() {
  document.querySelector(".verify-banner")?.remove();
  const user = auth.currentUser;
  const usesPassword = user && user.providerData.some((p) => p.providerId === "password");
  if (!user || user.emailVerified || !usesPassword) return;
  const bar = document.createElement("div");
  bar.className = "verify-banner";
  bar.innerHTML = `<span>Confirme seu e-mail (${esc(user.email)}) para poder comentar e avaliar.</span>
    <button type="button" class="btn btn-secondary btn-sm" data-resend>Reenviar e-mail</button>
    <button type="button" class="btn btn-ghost btn-sm" data-check>Já confirmei</button>`;
  document.body.prepend(bar);
  bar.querySelector("[data-resend]").addEventListener("click", async () => {
    try {
      await sendEmailVerification(user);
      toast("E-mail reenviado. Veja também a caixa de spam.");
    } catch (error) {
      toast(authMessage(error));
    }
  });
  bar.querySelector("[data-check]").addEventListener("click", async () => {
    await user.reload();
    if (user.emailVerified) {
      await user.getIdToken(true);
      bar.remove();
      toast("E-mail confirmado. Tudo liberado!");
    } else {
      toast("Ainda não apareceu como confirmado. Clique no link do e-mail primeiro.");
    }
  });
}

document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-auth-open]");
  if (opener) {
    event.preventDefault();
    openAuthModal(opener.dataset.authOpen || "login");
    return;
  }
  document.querySelectorAll(".user-menu-panel").forEach((panel) => {
    if (!panel.contains(event.target)) {
      panel.hidden = true;
      panel.previousElementSibling?.setAttribute("aria-expanded", "false");
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeModal();
  document.querySelectorAll(".user-menu-panel").forEach((panel) => (panel.hidden = true));
});

function consentAllowsAnalytics() {
  try {
    const prefs = JSON.parse(localStorage.getItem("pipoca_cookie_consent") || "null");
    return Boolean(prefs && prefs.analytics);
  } catch {
    return false;
  }
}

if (consentAllowsAnalytics()) startAnalytics();
document.addEventListener("pipoca:consent", (event) => {
  if (event.detail && event.detail.analytics) startAnalytics();
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.profile = null;
  if (user) {
    try {
      await ensureUserDoc(user);
      state.profile = await getProfile(user.uid);
    } catch {
      state.profile = null;
    }
  }
  state.ready = true;
  renderSlot();
  renderVerifyBanner();
  listeners.forEach((callback) => callback(state.user, state.profile));
});

export { auth };
