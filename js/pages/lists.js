import "../app.js";
import { published } from "../data.js";
import { cardList } from "../shared/cards.js";

async function load() {
  const box = document.getElementById("lists-grid");
  const soon = document.getElementById("coming-soon");
  try {
    const items = await published("lists", "publishedAt", "desc", 30);
    if (!items.length) return;
    box.innerHTML = items.map(cardList).join("");
    box.hidden = false;
    soon.hidden = true;
  } catch {
    return;
  }
}

load();
