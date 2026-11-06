import { esc, imageUrl, colorPair, ratingLabel, initialOf, formatDateBR } from "./util.js";

export function typeInfo(type) {
  return type === "series" || type === "serie"
    ? { base: "/series/", label: "Série" }
    : { base: "/filmes/", label: "Filme" };
}

export function posterInner(doc, size = "w342") {
  const src = imageUrl(doc.posterPath, size);
  return src
    ? `<img src="${esc(src)}" alt="Pôster de ${esc(doc.title)}" loading="lazy" decoding="async" width="342" height="513">`
    : `<div class="card-poster-initial">${esc(initialOf(doc.title))}</div>`;
}

export function posterStyle(doc) {
  const [a, b] = colorPair(doc);
  return `--poster-a:${a};--poster-b:${b}`;
}

export function cardTitle(item) {
  const info = typeInfo(item.type);
  const rating = ratingLabel(item);
  const overlay = rating
    ? `<div class="card-poster-overlay"><span class="rating"><span class="icon" data-icon="star"></span>${rating}</span></div>`
    : "";
  const meta = item.type === "series"
    ? esc(item.statusText || item.yearsText || "Série")
    : esc([item.year, (item.genres || [])[0]].filter(Boolean).join(" · ") || info.label);
  return `<a class="card-poster" href="${info.base}${esc(item.slug)}">
  <div class="card-poster-art" style="${posterStyle(item)}">${posterInner(item)}${overlay}</div>
  <h3>${esc(item.title)}</h3><div class="meta">${meta}</div>
</a>`;
}

export function cardPerson(person) {
  const src = imageUrl(person.photoPath, "w185");
  const inner = src
    ? `<img src="${esc(src)}" alt="Foto de ${esc(person.name)}" loading="lazy" decoding="async">`
    : esc(initialOf(person.name));
  return `<a class="card-person" href="/elenco/${esc(person.slug)}">
  <div class="card-person-photo" style="${posterStyle(person)}">${inner}</div>
  <h3>${esc(person.name)}</h3><div class="meta">${esc(person.role || "")}</div>
</a>`;
}

export function cardNews(news, withExcerpt = false) {
  const cover = imageUrl(news.coverUrl, "w500");
  const thumb = cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : "";
  const date = formatDateBR(news.publishedAt);
  const meta = [news.category, withExcerpt ? news.author : "", date].filter(Boolean).map(esc).join(" · ");
  const excerpt = withExcerpt && news.excerpt ? `<p style="font-size:var(--fs-sm); margin:var(--space-1) 0">${esc(news.excerpt)}</p>` : "";
  return `<a class="card-news" href="/noticias/${esc(news.slug)}">
  <div class="card-news-thumb" style="${posterStyle(news)}">${thumb}</div>
  <div><h3>${esc(news.title)}</h3>${excerpt}<div class="meta">${meta}</div></div>
</a>`;
}

export function cardReview(review) {
  const date = formatDateBR(review.publishedAt);
  const score = review.score ? `Nota ${Number(review.score).toFixed(1)}` : "";
  const meta = [review.targetTitle, score, date].filter(Boolean).map(esc).join(" · ");
  return `<a class="card-news" href="/analises/${esc(review.slug)}">
  <div class="card-news-thumb" style="${posterStyle(review)}">${review.coverUrl ? `<img src="${esc(imageUrl(review.coverUrl, "w500"))}" alt="" loading="lazy" decoding="async">` : ""}</div>
  <div><h3>${esc(review.title)}</h3>${review.excerpt ? `<p style="font-size:var(--fs-sm); margin:var(--space-1) 0">${esc(review.excerpt)}</p>` : ""}<div class="meta">${meta}</div></div>
</a>`;
}

export function cardList(list) {
  const count = (list.items || []).length;
  return `<a class="card-news" href="/listas/${esc(list.slug)}">
  <div class="card-news-thumb" style="${posterStyle(list)}">${list.coverUrl ? `<img src="${esc(imageUrl(list.coverUrl, "w500"))}" alt="" loading="lazy" decoding="async">` : ""}</div>
  <div><h3>${esc(list.title)}</h3>${list.description ? `<p style="font-size:var(--fs-sm); margin:var(--space-1) 0">${esc(list.description)}</p>` : ""}<div class="meta">${count} ${count === 1 ? "título" : "títulos"}</div></div>
</a>`;
}

export function rankingRow(item, position, mode) {
  const info = typeInfo(item.type);
  const detail = mode === "popular"
    ? `${(Number(item.ratingCount) || 0).toLocaleString("pt-BR")} avaliações`
    : `${ratingLabel(item) || "—"} de nota`;
  const art = imageUrlOrInitial(item);
  return `<li style="display:flex; align-items:center; gap:var(--space-5); background:var(--bg-card); border-radius:var(--radius-md); padding:var(--space-4)">
  <span style="font-size:var(--fs-xl); font-weight:800; color:var(--text-secondary); width:2ch; flex-shrink:0; text-align:center">${position}</span>
  <div class="card-poster-art" style="${posterStyle(item)}; width:56px; flex-shrink:0">${art}</div>
  <a href="${info.base}${esc(item.slug)}" style="flex:1; min-width:0">
    <h3 style="font-size:var(--fs-sm)">${esc(item.title)}</h3>
    <div class="meta">${info.label} · ${detail}</div>
  </a>
</li>`;
}

function imageUrlOrInitial(item) {
  const src = imageUrl(item.posterPath, "w154");
  return src
    ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`
    : `<div class="card-poster-initial" style="font-size:1.2rem">${esc(initialOf(item.title))}</div>`;
}
