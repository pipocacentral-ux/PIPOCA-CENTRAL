import "../app.js";
import { published } from "../data.js";
import { cardTitle } from "../shared/cards.js";

async function load() {
  const el = document.getElementById("release-list");
  try {
    const [movies, series] = await Promise.all([
      published("movies", "releaseDate", "desc", 24),
      published("series", "releaseDate", "desc", 12),
    ]);
    const items = [...movies, ...series].sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || ""))).slice(0, 36);
    el.innerHTML = items.length ? items.map(cardTitle).join("") : `<p style="color:var(--text-secondary)">Nenhum lançamento cadastrado ainda.</p>`;
  } catch {
    el.innerHTML = `<p style="color:var(--text-secondary)">Não foi possível carregar agora. Tente de novo em instantes.</p>`;
  }
  window.hydrateIcons?.(el);
}

load();
