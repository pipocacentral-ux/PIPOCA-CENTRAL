import { onAuth, api, toast, requireAuth, requireVerified, state } from "../app.js";
import { fetchComments } from "../data.js";
import { getListState, setListItem, getMyRating } from "../user.js";
import { esc, initialOf, timeAgo, pluralize } from "../shared/util.js";

const main = document.getElementById("main");
const type = main.dataset.type;
const slug = main.dataset.slug;
const item = {
  type,
  slug,
  title: main.dataset.title,
  posterPath: main.dataset.poster || "",
  year: Number(main.dataset.releaseYear) || null,
  color: (main.dataset.color || "").split(",").length === 2 ? main.dataset.color.split(",") : null,
};

const buttons = {
  favorite: document.querySelector('[data-action="favorite"]'),
  watchlist: document.querySelector('[data-action="watchlist"]'),
};
const listNames = { favorite: "favorites", watchlist: "watchlist" };
const flags = { favorite: false, watchlist: false };

function paintButton(name) {
  const btn = buttons[name];
  if (!btn) return;
  btn.classList.toggle("is-active", flags[name]);
  btn.setAttribute("aria-pressed", String(flags[name]));
}

async function toggleList(name) {
  if (!requireAuth()) return;
  const uid = state.user.uid;
  const next = !flags[name];
  flags[name] = next;
  paintButton(name);
  try {
    await setListItem(uid, listNames[name], item, next);
    toast(
      name === "favorite"
        ? next ? "Adicionado aos favoritos." : "Removido dos favoritos."
        : next ? "Salvo em “Assistir depois”." : "Removido de “Assistir depois”."
    );
  } catch {
    flags[name] = !next;
    paintButton(name);
    toast("Não foi possível salvar agora. Tente de novo.");
  }
}

Object.entries(buttons).forEach(([name, btn]) => btn?.addEventListener("click", () => toggleList(name)));

const widget = document.querySelector("[data-rate-widget]");
const clearBtn = document.querySelector("[data-rate-clear]");
let myRating = 0;

function paintStars(value) {
  widget?.querySelectorAll(".star-btn").forEach((btn) => btn.classList.toggle("is-on", Number(btn.dataset.value) <= value));
  if (clearBtn) clearBtn.hidden = !myRating;
}

function paintAggregate(data) {
  const card = document.getElementById("rating-card");
  if (!card) return;
  const count = Number(data.ratingCount) || 0;
  card.querySelector("[data-rating-value]").textContent = count && data.ratingAvg ? Number(data.ratingAvg).toFixed(1) : "—";
  card.querySelector("[data-rating-count]").textContent = count ? pluralize(count, "avaliação", "avaliações") : "Ainda sem avaliações";
  const filled = Math.round(Number(data.ratingAvg) || 0);
  card.querySelectorAll("[data-rating-stars] .icon").forEach((star, i) => {
    star.style.color = i < filled ? "" : "var(--border-strong)";
  });
  const dist = data.ratingDist || {};
  const rows = card.querySelectorAll(".rating-bar-row");
  [5, 4, 3, 2, 1].forEach((n, i) => {
    const pct = count ? Math.round(((Number(dist[n]) || 0) / count) * 100) : 0;
    rows[i].querySelector(".rating-bar-fill").style.width = `${pct}%`;
    rows[i].lastElementChild.textContent = `${pct}%`;
  });
}

async function sendRating(value) {
  if (!(await requireVerified())) return;
  const previous = myRating;
  myRating = value;
  paintStars(value);
  try {
    const data = await api("rate", { type, slug, value });
    paintAggregate(data);
    toast(value ? "Sua nota foi salva." : "Sua nota foi removida.");
  } catch (error) {
    myRating = previous;
    paintStars(previous);
    toast(error.message);
  }
}

widget?.querySelectorAll(".star-btn").forEach((btn) => {
  const value = Number(btn.dataset.value);
  btn.addEventListener("mouseenter", () => paintStars(value));
  btn.addEventListener("focus", () => paintStars(value));
  btn.addEventListener("click", () => sendRating(value));
});
widget?.addEventListener("mouseleave", () => paintStars(myRating));
widget?.addEventListener("focusout", () => paintStars(myRating));
clearBtn?.addEventListener("click", () => sendRating(0));

const list = document.getElementById("comments-list");
const more = document.getElementById("comments-more");
const form = document.getElementById("comment-form");
const hint = document.getElementById("comment-hint");
let cursor = null;

function commentHtml(c) {
  const mine = state.user && c.uid === state.user.uid;
  const avatar = c.avatarUrl
    ? `<img src="${esc(c.avatarUrl)}" alt="" width="40" height="40" referrerpolicy="no-referrer" loading="lazy">`
    : esc(initialOf(c.displayName));
  const action = mine
    ? `<button type="button" class="comment-action" data-delete="${esc(c.id)}">Excluir</button>`
    : `<button type="button" class="comment-action" data-report="${esc(c.id)}">Denunciar</button>`;
  return `<div class="comment-item" data-id="${esc(c.id)}">
  <div class="comment-avatar">${avatar}</div>
  <div style="flex:1; min-width:0">
    <div class="comment-head"><strong>${esc(c.displayName)}</strong><span>${esc(timeAgo(c.createdAt))}</span>${action}</div>
    <p style="white-space:pre-wrap; overflow-wrap:anywhere">${esc(c.text)}</p>
  </div>
</div>`;
}

async function loadComments(reset) {
  if (reset) {
    cursor = null;
    list.innerHTML = "";
  }
  try {
    const page = await fetchComments(type, slug, cursor);
    cursor = page.cursor;
    list.insertAdjacentHTML("beforeend", page.items.map(commentHtml).join(""));
    more.hidden = !page.hasMore;
    if (reset && !page.items.length) list.innerHTML = `<p style="color:var(--text-secondary); font-size:var(--fs-sm)">Ninguém comentou ainda. Que tal começar?</p>`;
  } catch {
    list.innerHTML = `<p style="color:var(--text-secondary); font-size:var(--fs-sm)">Não foi possível carregar os comentários agora.</p>`;
  }
}

more?.addEventListener("click", () => loadComments(false));

list?.addEventListener("click", async (event) => {
  const del = event.target.closest("[data-delete]");
  const rep = event.target.closest("[data-report]");
  if (del && confirm("Excluir este comentário?")) {
    try {
      await api("deleteComment", { id: del.dataset.delete });
      del.closest(".comment-item").remove();
      toast("Comentário excluído.");
    } catch (error) {
      toast(error.message);
    }
  }
  if (rep) {
    if (!requireAuth()) return;
    try {
      await api("reportComment", { id: rep.dataset.report });
      rep.textContent = "Denunciado";
      rep.disabled = true;
      toast("Obrigado! Vamos analisar esse comentário.");
    } catch (error) {
      toast(error.message);
    }
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await requireVerified())) return;
  const button = form.querySelector("button[type=submit]");
  const text = form.text.value.trim();
  if (text.length < 2) return;
  button.disabled = true;
  try {
    const result = await api("comment", { type, slug, text });
    form.reset();
    if (result.status === "visible") {
      await loadComments(true);
      toast("Comentário publicado.");
    } else {
      toast("Seu comentário foi enviado para revisão e aparece assim que for aprovado.");
    }
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("[data-trailer]")?.addEventListener("click", (event) => {
  const key = event.currentTarget.dataset.trailer;
  if (!/^[\w-]{6,20}$/.test(key)) return;
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `<div class="modal-scrim" data-close></div>
    <div class="modal-panel modal-wide" role="dialog" aria-modal="true" aria-label="Trailer">
      <button class="icon-btn modal-close" data-close aria-label="Fechar"><span class="icon" data-icon="close"></span></button>
      <div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0" title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    </div>`;
  document.body.appendChild(modal);
  window.hydrateIcons?.(modal);
  document.body.style.overflow = "hidden";
  const close = () => {
    modal.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  modal.addEventListener("click", (e) => e.target.closest("[data-close]") && close());
  modal.querySelector(".modal-close").focus();
});

loadComments(true);

onAuth(async (user) => {
  const hintText = !user
    ? "Entre na sua conta para comentar."
    : user.emailVerified
      ? "Comentários com links ou palavrões passam por revisão antes de aparecer."
      : "Confirme seu e-mail para comentar.";
  if (hint) hint.textContent = hintText;
  if (!user) {
    flags.favorite = false;
    flags.watchlist = false;
    myRating = 0;
    paintButton("favorite");
    paintButton("watchlist");
    paintStars(0);
    return;
  }
  try {
    const [lists, rating] = await Promise.all([getListState(user.uid, type, slug), getMyRating(user.uid, type, slug)]);
    flags.favorite = lists.favorite;
    flags.watchlist = lists.watchlist;
    myRating = rating;
  } catch {
    myRating = 0;
  }
  paintButton("favorite");
  paintButton("watchlist");
  paintStars(myRating);
  loadComments(true);
});
