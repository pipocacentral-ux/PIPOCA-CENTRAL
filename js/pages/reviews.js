import "../app.js";
import { published } from "../data.js";
import { cardReview } from "../shared/cards.js";

async function load() {
  const box = document.getElementById("review-list");
  const soon = document.getElementById("coming-soon");
  try {
    const items = await published("reviews", "publishedAt", "desc", 30);
    if (!items.length) return;
    box.innerHTML = items.map(cardReview).join("");
    box.hidden = false;
    soon.hidden = true;
  } catch {
    return;
  }
}

load();
