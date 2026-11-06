import "../app.js";
import { published } from "../data.js";
import { cardTitle, cardNews } from "../shared/cards.js";

function fill(id, html, emptyText) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html || `<p style="color:var(--text-secondary)">${emptyText}</p>`;
  window.hydrateIcons?.(el);
}

async function load() {
  const [movies, series, news] = await Promise.allSettled([
    published("movies", "popularity", "desc", 6),
    published("series", "popularity", "desc", 6),
    published("news", "publishedAt", "desc", 3),
  ]);
  const ok = (r) => (r.status === "fulfilled" ? r.value : []);
  fill("home-movies", ok(movies).map(cardTitle).join(""), "Os primeiros filmes chegam em breve.");
  fill("home-series", ok(series).map(cardTitle).join(""), "As primeiras séries chegam em breve.");
  fill("home-news", ok(news).map((n) => cardNews(n)).join(""), "Em breve, novidades por aqui.");
}

load();
