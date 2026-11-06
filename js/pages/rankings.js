import "../app.js";
import { published } from "../data.js";
import { rankingRow } from "../shared/cards.js";

const list = document.getElementById("ranking-list");
const cache = {};

async function load(mode) {
  if (!cache[mode]) {
    const field = mode === "popular" ? "ratingCount" : "rankScore";
    const [movies, series] = await Promise.all([
      published("movies", field, "desc", 10),
      published("series", field, "desc", 10),
    ]);
    cache[mode] = [...movies, ...series]
      .filter((item) => (Number(item.ratingCount) || 0) > 0)
      .sort((a, b) => (mode === "popular" ? (b.ratingCount || 0) - (a.ratingCount || 0) : (b.rankScore || 0) - (a.rankScore || 0)))
      .slice(0, 10);
  }
  return cache[mode];
}

async function render(mode) {
  try {
    const items = await load(mode);
    list.innerHTML = items.length
      ? items.map((item, i) => rankingRow(item, i + 1, mode)).join("")
      : `<li style="color:var(--text-secondary)">O ranking aparece quando a comunidade começar a avaliar.</li>`;
  } catch {
    list.innerHTML = `<li style="color:var(--text-secondary)">Não foi possível carregar agora. Tente de novo em instantes.</li>`;
  }
}

document.querySelectorAll(".filter-tab[data-rank]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab[data-rank]").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    render(tab.dataset.rank);
  });
});

render("rating");
