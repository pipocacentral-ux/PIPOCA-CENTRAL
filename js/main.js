/* ==========================================================================
   PipocaCentral — main.js
   Interações client-side. Em produção, favoritar/avaliar/comentar/buscar
   passam a chamar Firestore (via SDK ou pelas serverless functions) —
   por enquanto ficam como demonstração visual, sem persistir nada.
   ========================================================================== */

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
};

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.dataset.icon;
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
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

/* ---------- "Ações" que dependem de login (favoritar, assistir depois, avaliar) ---------- */
function setupAuthGatedActions() {
  document.querySelectorAll("[data-requires-auth]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("Crie sua conta para usar essa função — chega na próxima fase, junto com o cadastro de verdade.");
    });
  });
  document.querySelectorAll(".stars.is-interactive .icon").forEach((star, idx, all) => {
    star.addEventListener("click", () => {
      showToast("Sua nota vai ficar salva assim que o cadastro estiver ativo. Por enquanto é só demonstração.");
    });
  });
}

/* ---------- Banner de consentimento de cookies (Seção 16.3) ---------- */
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
}

function renderCookieBanner() {
  if (document.querySelector(".cookie-banner")) return;
  const existing = getCookiePrefs();

  const el = document.createElement("div");
  el.className = "cookie-banner";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Preferências de cookies");
  el.innerHTML = `
    <h2>A gente usa cookies</h2>
    <p>Usamos cookies essenciais para o site funcionar e, com sua permissão, também para métricas e anúncios. Você pode escolher o que aceitar e mudar de ideia quando quiser em <a href="cookies.html" style="color:var(--color-brand)">Política de Cookies</a>.</p>
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
    el.querySelectorAll("input[data-cat]").forEach((i) => (i.checked = true));
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

  if (existing) el.remove();
}

/* ---------- Busca client-side (demonstração — em produção é Firestore) ---------- */
function runSearchDemo() {
  const resultsEl = document.getElementById("search-results");
  const emptyEl = document.getElementById("search-empty");
  const skeletonEl = document.getElementById("search-skeleton");
  const input = document.getElementById("search-input");
  const tabs = document.querySelectorAll(".filter-tab[data-type]");
  if (!resultsEl || !input) return;

  let activeType = new URLSearchParams(location.search).get("tipo") || "todos";

  function cardMovie(m) {
    return `<a class="card-poster" href="filme.html">
      <div class="card-poster-art" style="--poster-a:${m.color[0]};--poster-b:${m.color[1]}">
        <div class="card-poster-initial">${m.title[0]}</div>
        <div class="card-poster-overlay"><span class="rating"><span class="icon" data-icon="star"></span>${m.ratingAvg}</span></div>
      </div>
      <h3>${m.title}</h3><div class="meta">${m.year} · Filme</div>
    </a>`;
  }
  function cardSeries(s) {
    return `<a class="card-poster" href="serie.html">
      <div class="card-poster-art" style="--poster-a:${s.color[0]};--poster-b:${s.color[1]}">
        <div class="card-poster-initial">${s.title[0]}</div>
        <div class="card-poster-overlay"><span class="rating"><span class="icon" data-icon="star"></span>${s.ratingAvg}</span></div>
      </div>
      <h3>${s.title}</h3><div class="meta">${s.years} · Série</div>
    </a>`;
  }
  function cardPerson(p) {
    return `<a class="card-person" href="ator.html">
      <div class="card-person-photo" style="--poster-a:${p.color[0]};--poster-b:${p.color[1]}">${p.name[0]}</div>
      <h3>${p.name}</h3><div class="meta">${p.role}</div>
    </a>`;
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    if (skeletonEl) skeletonEl.style.display = "grid";
    resultsEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "none";

    setTimeout(() => {
      const movies = activeType === "todos" || activeType === "filme" ? MOVIES.filter((m) => m.title.toLowerCase().includes(q)) : [];
      const series = activeType === "todos" || activeType === "serie" ? SERIES.filter((s) => s.title.toLowerCase().includes(q)) : [];
      const people = activeType === "todos" || activeType === "pessoa" ? PEOPLE.filter((p) => p.name.toLowerCase().includes(q)) : [];

      const total = movies.length + series.length + people.length;
      if (skeletonEl) skeletonEl.style.display = "none";

      if (total === 0) {
        if (emptyEl) emptyEl.style.display = "block";
        resultsEl.style.display = "none";
        return;
      }

      resultsEl.style.display = "grid";
      resultsEl.innerHTML = [...movies.map(cardMovie), ...series.map(cardSeries), ...people.map(cardPerson)].join("");
      hydrateIcons(resultsEl);
    }, 350);
  }

  tabs.forEach((tab) => {
    if (tab.dataset.type === activeType) tab.classList.add("is-active");
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      activeType = tab.dataset.type;
      render();
    });
  });

  input.addEventListener("input", render);
  render();

  const filtersToggle = document.querySelector(".filters-toggle");
  const filtersPanel = document.querySelector(".filters-panel");
  filtersToggle?.addEventListener("click", () => {
    filtersPanel.classList.toggle("is-open");
    filtersToggle.setAttribute("aria-expanded", filtersPanel.classList.contains("is-open"));
  });
}

function setupContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast("Formulário pronto, mas ainda não conectado — o envio real entra junto com o backend.");
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hydrateIcons();
  setupMobileDrawer();
  setupAuthGatedActions();
  renderCookieBanner();
  runSearchDemo();
  setupContactForm();

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link, .mobile-drawer-link").forEach((link) => {
    if (link.getAttribute("href") === path) link.classList.add("is-active");
  });
});
