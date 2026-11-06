const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15 9 22 9.3 17 14 18.5 21 12 17.3 5.5 21 7 14 2 9.3 9 9"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M5 4H3v2a4 4 0 0 0 4 4M19 4h2v2a4 4 0 0 1-4 4"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="2" y1="9" x2="7" y2="9"/><line x1="2" y1="15" x2="7" y2="15"/><line x1="17" y1="9" x2="22" y2="9"/><line x1="17" y1="15" x2="22" y2="15"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 3-5 4-5-4"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  newspaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12v14a2 2 0 0 1-2 2H4z"/><path d="M16 8h4v10a2 2 0 0 1-2 2h-2"/><line x1="8" y1="9" x2="12" y2="9"/><line x1="8" y1="13" x2="12" y2="13"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4z"/></svg>',
  google: '<svg viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9a6.1 6.1 0 0 1 0-12.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/></svg>',
};

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.dataset.icon;
    if (ICONS[name] && !el.firstElementChild) el.innerHTML = ICONS[name];
  });
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

function setupMobileDrawer() {
  const toggle = document.querySelector(".nav-toggle");
  const drawer = document.querySelector(".mobile-drawer");
  if (!toggle || !drawer) return;
  const close = drawer.querySelector(".drawer-close");
  const scrim = drawer.querySelector(".mobile-drawer-scrim");
  const open = () => { drawer.classList.add("is-open"); document.body.style.overflow = "hidden"; };
  const closeDrawer = () => { drawer.classList.remove("is-open"); document.body.style.overflow = ""; };
  toggle.addEventListener("click", open);
  close?.addEventListener("click", closeDrawer);
  scrim?.addEventListener("click", closeDrawer);
}

const COOKIE_KEY = "pipoca_cookie_consent";

function getCookiePrefs() {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCookiePrefs(prefs) {
  try { localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs)); } catch {}
  document.dispatchEvent(new CustomEvent("pipoca:consent", { detail: prefs }));
}

function renderCookieBanner() {
  if (document.querySelector(".cookie-banner") || getCookiePrefs()) return;

  const el = document.createElement("div");
  el.className = "cookie-banner";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Preferências de cookies");
  el.innerHTML = `
    <h2>A gente usa cookies</h2>
    <p>Usamos cookies essenciais para o site funcionar e, com sua permissão, também para métricas e anúncios. Você pode escolher o que aceitar e mudar de ideia quando quiser em <a href="/cookies" style="color:var(--color-brand)">Política de Cookies</a>.</p>
    <div class="cookie-categories">
      <label class="cookie-cat">
        <span><span class="name">Essenciais</span><span class="desc">Necessários para login e navegação — não dá para desligar.</span></span>
        <span class="switch"><input type="checkbox" checked disabled><span class="track"><span class="thumb"></span></span></span>
      </label>
      <label class="cookie-cat">
        <span><span class="name">Desempenho e analytics</span><span class="desc">Ajudam a entender o que está funcionando no site.</span></span>
        <span class="switch"><input type="checkbox" data-cat="analytics" checked><span class="track"><span class="thumb"></span></span></span>
      </label>
      <label class="cookie-cat">
        <span><span class="name">Publicidade</span><span class="desc">Usados pelo Google AdSense para anúncios.</span></span>
        <span class="switch"><input type="checkbox" data-cat="ads" checked><span class="track"><span class="thumb"></span></span></span>
      </label>
      <label class="cookie-cat">
        <span><span class="name">Funcionalidades</span><span class="desc">Lembram preferências como avatar e tema.</span></span>
        <span class="switch"><input type="checkbox" data-cat="functional" checked><span class="track"><span class="thumb"></span></span></span>
      </label>
    </div>
    <div class="cookie-actions">
      <button class="btn btn-primary" data-action="accept-all">Aceitar tudo</button>
      <button class="btn btn-secondary" data-action="save">Salvar escolhas</button>
      <button class="btn btn-ghost" data-action="reject">Só essenciais</button>
    </div>
  `;
  document.body.appendChild(el);
  hydrateIcons(el);
  requestAnimationFrame(() => el.classList.add("is-visible"));

  const closeBanner = () => el.classList.remove("is-visible");

  el.querySelector('[data-action="accept-all"]').addEventListener("click", () => {
    saveCookiePrefs({ analytics: true, ads: true, functional: true });
    closeBanner();
    showToast("Preferências salvas.");
  });
  el.querySelector('[data-action="save"]').addEventListener("click", () => {
    const prefs = {};
    el.querySelectorAll("input[data-cat]").forEach((i) => (prefs[i.dataset.cat] = i.checked));
    saveCookiePrefs(prefs);
    closeBanner();
    showToast("Preferências salvas.");
  });
  el.querySelector('[data-action="reject"]').addEventListener("click", () => {
    saveCookiePrefs({ analytics: false, ads: false, functional: false });
    closeBanner();
    showToast("Só os cookies essenciais foram mantidos.");
  });
}

function highlightNav() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const tipo = new URLSearchParams(location.search).get("tipo");
  const sections = { "/filmes": "filme", "/series": "serie", "/elenco": "pessoa" };
  const root = "/" + path.split("/")[1];
  document.querySelectorAll(".nav-link, .mobile-drawer-link").forEach((link) => {
    const url = new URL(link.getAttribute("href"), location.origin);
    const linkPath = url.pathname.replace(/\/+$/, "") || "/";
    const linkTipo = url.searchParams.get("tipo");
    let active = false;
    if (linkTipo) {
      active = (linkPath === path && linkTipo === tipo) || sections[root] === linkTipo;
    } else if (linkPath === "/busca") {
      active = path === "/busca" && !tipo;
    } else {
      active = linkPath === path || (linkPath !== "/" && root === linkPath);
    }
    link.classList.toggle("is-active", active);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hydrateIcons();
  setupMobileDrawer();
  renderCookieBanner();
  highlightNav();
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
});
