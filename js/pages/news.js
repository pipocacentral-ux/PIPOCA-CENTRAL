import "../app.js";
import { published } from "../data.js";
import { cardNews } from "../shared/cards.js";

async function load() {
  const el = document.getElementById("news-list");
  try {
    const items = await published("news", "publishedAt", "desc", 30);
    el.innerHTML = items.length ? items.map((n) => cardNews(n, true)).join("") : `<p style="color:var(--text-secondary)">As primeiras notícias chegam em breve.</p>`;
  } catch {
    el.innerHTML = `<p style="color:var(--text-secondary)">Não foi possível carregar agora. Tente de novo em instantes.</p>`;
  }
}

load();
