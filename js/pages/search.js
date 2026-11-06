import "../app.js";
import { searchCollection } from "../data.js";
import { cardTitle, cardPerson } from "../shared/cards.js";
import { esc } from "../shared/util.js";

const resultsEl = document.getElementById("search-results");
const emptyEl = document.getElementById("search-empty");
const skeletonEl = document.getElementById("search-skeleton");
const input = document.getElementById("search-input");
const tabs = document.querySelectorAll(".filter-tab[data-type]");
const selects = {
  genre: document.getElementById("f-genre"),
  year: document.getElementById("f-year"),
  rating: document.getElementById("f-rating"),
  platform: document.getElementById("f-platform"),
};

const params = new URLSearchParams(location.search);
let activeType = ["filme", "serie", "pessoa"].includes(params.get("tipo")) ? params.get("tipo") : "todos";
let current = [];
let sequence = 0;
let timer = null;

input.value = params.get("q") || "";

function platformNames(item) {
  return (item.platforms || []).map((p) => (typeof p === "string" ? p : p.name)).filter(Boolean);
}

function fillOptions(select, values, anyLabel) {
  const previous = select.value;
  const sorted = [...new Set(values)].filter(Boolean).sort((a, b) => String(b).localeCompare(String(a), "pt-BR", { numeric: true }));
  select.innerHTML = `<option value="">${anyLabel}</option>` + sorted.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  if (sorted.includes(previous)) select.value = previous;
}

function genresSorted(items) {
  return [...new Set(items.flatMap((i) => i.genres || []))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function refreshFilters(items) {
  const titles = items.filter((i) => i.type !== "person");
  const genre = selects.genre.value;
  selects.genre.innerHTML = `<option value="">Todos</option>` + genresSorted(titles).map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  if ([...selects.genre.options].some((o) => o.value === genre)) selects.genre.value = genre;
  fillOptions(selects.year, titles.map((i) => i.year), "Todos");
  fillOptions(selects.platform, titles.flatMap(platformNames), "Todas");
  selects.rating.innerHTML = `<option value="">Qualquer</option><option value="4">4+</option><option value="4.5">4.5+</option>`;
}

function applyFilters(items) {
  const genre = selects.genre.value;
  const year = selects.year.value;
  const min = Number(selects.rating.value) || 0;
  const platform = selects.platform.value;
  return items.filter((item) => {
    if (item.type === "person") return !genre && !year && !min && !platform;
    if (genre && !(item.genres || []).includes(genre)) return false;
    if (year && String(item.year) !== year) return false;
    if (min && !(Number(item.ratingAvg) >= min && Number(item.ratingCount) > 0)) return false;
    if (platform && !platformNames(item).includes(platform)) return false;
    return true;
  });
}

function draw() {
  const visible = applyFilters(current);
  skeletonEl.style.display = "none";
  if (!visible.length) {
    resultsEl.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";
  resultsEl.style.display = "grid";
  resultsEl.innerHTML = visible.map((item) => (item.type === "person" ? cardPerson(item) : cardTitle(item))).join("");
  window.hydrateIcons?.(resultsEl);
}

async function search() {
  const mine = ++sequence;
  const text = input.value.trim();
  skeletonEl.style.display = "grid";
  resultsEl.style.display = "none";
  emptyEl.style.display = "none";
  const wanted = [];
  if (activeType === "todos" || activeType === "filme") wanted.push(searchCollection("movies", text));
  if (activeType === "todos" || activeType === "serie") wanted.push(searchCollection("series", text));
  if (activeType === "todos" || activeType === "pessoa") wanted.push(searchCollection("people", text, 24));
  try {
    const groups = await Promise.all(wanted);
    if (mine !== sequence) return;
    current = groups.flat();
    refreshFilters(current);
    draw();
  } catch {
    if (mine !== sequence) return;
    current = [];
    skeletonEl.style.display = "none";
    resultsEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.querySelector("h3").textContent = "Não foi possível buscar agora";
    emptyEl.querySelector("p").textContent = "Tente de novo em instantes.";
  }
}

tabs.forEach((tab) => {
  tab.classList.toggle("is-active", tab.dataset.type === activeType);
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    activeType = tab.dataset.type;
    search();
  });
});

input.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(search, 300);
});

Object.values(selects).forEach((select) => select.addEventListener("change", draw));

const toggle = document.querySelector(".filters-toggle");
const panel = document.querySelector(".filters-panel");
toggle?.addEventListener("click", () => {
  panel.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", panel.classList.contains("is-open"));
});

search();
