import { esc, imageUrl, colorPair, formatDuration, isoDuration, formatDateBR, ratingLabel, initialOf, pluralize } from "../js/shared/util.js";
import { cardTitle, cardNews, posterInner, posterStyle } from "../js/shared/cards.js";
import { renderMarkdown } from "../js/shared/markdown.js";

function clip(text, max = 155) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function crumbs(items) {
  const parts = items.map((item, i) => {
    const last = i === items.length - 1;
    return last
      ? `<span class="current">${esc(item.label)}</span>`
      : `<a href="${esc(item.href)}">${esc(item.label)}</a><span class="sep">/</span>`;
  });
  return `<nav class="breadcrumbs" aria-label="Trilha de navegação">${parts.join("")}</nav>`;
}

function breadcrumbLd(origin, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `${origin}${item.href || ""}`,
    })),
  };
}

function ratingLd(doc) {
  const count = Number(doc.ratingCount) || 0;
  if (!count || !doc.ratingAvg) return undefined;
  return {
    "@type": "AggregateRating",
    ratingValue: String(doc.ratingAvg),
    reviewCount: String(count),
    bestRating: "5",
    worstRating: "1",
  };
}

function starsDisplay(avg) {
  const filled = Math.round(Number(avg) || 0);
  return [1, 2, 3, 4, 5]
    .map((n) => `<span class="icon" data-icon="star"${n > filled ? ' style="color:var(--border-strong)"' : ""}></span>`)
    .join("");
}

function ratingSection(doc) {
  const count = Number(doc.ratingCount) || 0;
  const dist = doc.ratingDist || {};
  const rows = [5, 4, 3, 2, 1]
    .map((n) => {
      const pct = count ? Math.round(((Number(dist[n]) || 0) / count) * 100) : 0;
      return `<div class="rating-bar-row"><span class="label">${n} ${n === 1 ? "estrela" : "estrelas"}</span><span class="rating-bar-track"><span class="rating-bar-fill" style="width:${pct}%"></span></span><span>${pct}%</span></div>`;
    })
    .join("");
  const summary = count ? pluralize(count, "avaliação", "avaliações") : "Ainda sem avaliações";
  return `<h2 style="margin-top:var(--space-8)">Avaliação da comunidade</h2>
<div class="rating-card" id="rating-card">
  <div class="rating-score">
    <div class="value" data-rating-value>${esc(ratingLabel(doc) || "—")}</div>
    <div class="stars" data-rating-stars>${starsDisplay(doc.ratingAvg)}</div>
    <div class="count" data-rating-count>${esc(summary)}</div>
  </div>
  <div class="rating-bars" data-rating-bars>${rows}</div>
</div>
<div style="margin-top:var(--space-4); display:flex; align-items:center; gap:var(--space-3); flex-wrap:wrap">
  <span style="font-size:var(--fs-sm); color:var(--text-secondary)">Sua nota:</span>
  <span class="stars is-interactive" data-rate-widget role="group" aria-label="Sua nota">
    ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn" data-value="${n}" aria-label="${n} ${n === 1 ? "estrela" : "estrelas"}"><span class="icon" data-icon="star"></span></button>`).join("")}
  </span>
  <button type="button" class="btn btn-ghost btn-sm" data-rate-clear hidden>Remover nota</button>
</div>`;
}

function commentsSection() {
  return `<h2 id="comentarios" style="margin-top:var(--space-8)">Comentários</h2>
<form class="field" id="comment-form" style="margin-bottom:var(--space-5)">
  <textarea name="text" placeholder="Compartilhe o que achou (sem spoiler, se puder)..." rows="3" maxlength="1500" required></textarea>
  <button type="submit" class="btn btn-primary" style="align-self:flex-end; margin-top:var(--space-2)">Comentar</button>
  <p class="field-hint" id="comment-hint"></p>
</form>
<div id="comments-list" aria-live="polite"></div>
<div style="margin-top:var(--space-4)"><button type="button" class="btn btn-secondary btn-sm" id="comments-more" hidden>Carregar mais</button></div>`;
}

function castSection(cast, linkable) {
  const items = (cast || []).slice(0, 14);
  if (!items.length) return "";
  const html = items
    .map((c) => {
      const src = imageUrl(c.photoPath, "w185");
      const photo = src
        ? `<img src="${esc(src)}" alt="Foto de ${esc(c.name)}" loading="lazy" decoding="async">`
        : esc(initialOf(c.name));
      const inner = `<div class="cast-photo" style="--poster-a:#2b2140;--poster-b:#171821">${photo}</div><h4>${esc(c.name)}</h4><div class="meta">${esc(c.character || "")}</div>`;
      return c.slug && linkable.has(c.slug)
        ? `<a href="/elenco/${esc(c.slug)}" class="cast-item">${inner}</a>`
        : `<div class="cast-item">${inner}</div>`;
    })
    .join("");
  return `<h2 style="margin-top:var(--space-8)">Elenco</h2><div class="cast-grid">${html}</div>`;
}

function platformsPanel(platforms) {
  const list = (platforms || []).map((p) => (typeof p === "string" ? p : p.name)).filter(Boolean);
  const body = list.length
    ? `<div style="display:flex; flex-direction:column; gap:var(--space-2)">${list.map((p) => `<span class="pill" style="justify-content:flex-start; padding:var(--space-3)">${esc(p)}</span>`).join("")}</div>`
    : `<p style="font-size:var(--fs-sm)">Ainda sem informação de streaming no Brasil.</p>`;
  return `<div class="panel"><h3 style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:var(--space-3)">Onde assistir</h3>${body}</div>`;
}

function techPanel(rows) {
  const filled = rows.filter(([, value]) => value && (!Array.isArray(value) || value.length));
  if (!filled.length) return "";
  const dl = filled
    .map(([label, value]) => `<div><dt style="color:var(--text-secondary)">${esc(label)}</dt><dd>${esc(Array.isArray(value) ? value.join(", ") : value)}</dd></div>`)
    .join("");
  return `<div class="panel" style="margin-top:var(--space-5)"><h3 style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:var(--space-3)">Ficha técnica</h3><dl style="display:flex; flex-direction:column; gap:var(--space-3); font-size:var(--fs-sm)">${dl}</dl></div>`;
}

function infoPanel(rows) {
  const filled = rows.filter(([, value]) => value);
  if (!filled.length) return "";
  const dl = filled
    .map(([label, value]) => `<div><dt style="color:var(--text-secondary)">${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
    .join("");
  return `<div class="panel" style="margin-top:var(--space-5)"><dl style="display:flex; flex-direction:column; gap:var(--space-3); font-size:var(--fs-sm)">${dl}</dl></div>`;
}

function relatedSection(title, items, id) {
  if (!items.length) return "";
  return `<section class="section-tight"><div class="section-header"><h2>${esc(title)}</h2></div><div class="card-grid" id="${id}">${items.map(cardTitle).join("")}</div></section>`;
}

function newsSection(items) {
  if (!items.length) return "";
  return `<section class="section-tight" style="padding-bottom:var(--space-8)"><div class="section-header"><h2>Notícias relacionadas</h2></div><div class="card-grid news">${items.map((n) => cardNews(n)).join("")}</div></section>`;
}

function mediaHero(doc, { type, trail, pills, facts }) {
  const [a] = colorPair(doc);
  const actions = `<div style="display:flex; gap:var(--space-3); flex-wrap:wrap; margin-top:var(--space-5)">
    ${doc.trailerKey ? `<button class="btn btn-primary" data-trailer="${esc(doc.trailerKey)}"><span class="icon" data-icon="play"></span> Assistir ao trailer</button>` : ""}
    <button class="icon-btn" style="background:var(--bg-card)" data-action="favorite" aria-pressed="false" aria-label="Favoritar"><span class="icon" data-icon="heart"></span></button>
    <button class="icon-btn" style="background:var(--bg-card)" data-action="watchlist" aria-pressed="false" aria-label="Assistir depois"><span class="icon" data-icon="clock"></span></button>
  </div>`;
  return `<div style="background:linear-gradient(155deg, ${esc(a)}, var(--bg-primary)); padding-block: var(--space-6) 0;">
  <div class="container">
    ${crumbs(trail)}
    <div style="display:flex; gap:var(--space-6); flex-wrap:wrap; align-items:flex-end; padding-bottom:var(--space-6)">
      <div class="card-poster-art" style="${posterStyle(doc)}; width:180px; flex-shrink:0; box-shadow:var(--shadow-elevated)">${posterInner(doc, "w342")}</div>
      <div style="flex:1; min-width:260px">
        <div style="display:flex; gap:var(--space-2); align-items:center">${pills}</div>
        <h1 style="margin-top:var(--space-3)">${esc(doc.title)}</h1>
        <div class="fact-row" style="margin-top:var(--space-3)">${facts}</div>
        <div class="fact-row" style="margin-top:var(--space-3)">${(doc.genres || []).map((g) => `<span class="pill">${esc(g)}</span>`).join("")}</div>
        ${actions}
      </div>
    </div>
  </div>
</div>`;
}

function mediaData(doc) {
  return ` data-poster="${esc(doc.posterPath || "")}" data-release-year="${esc(doc.year || "")}" data-color="${esc(colorPair(doc).join(","))}"`;
}

function fact(icon, text) {
  return text ? `<span class="fact"><span class="icon" data-icon="${icon}"></span>${esc(text)}</span>` : "";
}

export function moviePage(m, { origin, related = [], news = [], linkable = new Set() }) {
  const trail = [{ label: "Início", href: "/" }, { label: "Filmes", href: "/busca?tipo=filme" }, { label: m.title }];
  const facts = [
    fact("ticket", m.year),
    fact("clock", formatDuration(m.duration)),
    fact("user", m.director),
    m.certification ? `<span class="pill">${esc(m.certification)}</span>` : "",
  ].join("");
  const body = `<main id="main" data-type="movie" data-slug="${esc(m.slug)}" data-title="${esc(m.title)}"${mediaData(m)}>
${mediaHero(m, { type: "movie", trail, pills: `<span class="pill pill-brand">Filme</span>`, facts })}
  <div class="container">
    <div class="grid-2 section-tight">
      <aside>
        ${platformsPanel(m.platforms)}
        ${techPanel([["Direção", m.director], ["Roteiro", m.writers], ["País", m.country], ["Classificação", m.certification], ["Título original", m.originalTitle && m.originalTitle !== m.title ? m.originalTitle : ""]])}
      </aside>
      <div>
        <h2>Sinopse</h2>
        <p class="lead">${esc(m.synopsis || "Sinopse em breve.")}</p>
        ${castSection(m.cast, linkable)}
        ${ratingSection(m)}
        ${commentsSection()}
      </div>
    </div>
    ${relatedSection("Se você gostou deste, também pode gostar", related, "related-movies")}
    ${newsSection(news)}
  </div>
</main>`;
  const canonical = `${origin}/filmes/${m.slug}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Movie",
      name: m.title,
      datePublished: m.releaseDate || (m.year ? String(m.year) : undefined),
      description: clip(m.synopsis, 300) || undefined,
      image: imageUrl(m.posterPath, "w500") || undefined,
      director: m.director ? { "@type": "Person", name: m.director } : undefined,
      actor: (m.cast || []).slice(0, 8).map((c) => ({ "@type": "Person", name: c.name })),
      genre: m.genres,
      duration: isoDuration(m.duration) || undefined,
      aggregateRating: ratingLd(m),
    },
    breadcrumbLd(origin, [{ label: "Início", href: "/" }, { label: "Filmes", href: "/busca?tipo=filme" }, { label: m.title, href: `/filmes/${m.slug}` }]),
  ];
  return {
    title: `${m.title}${m.year ? ` (${m.year})` : ""} — Elenco, onde assistir e avaliações | PipocaCentral`,
    description: clip(m.synopsis) || `${m.title}: elenco, onde assistir e avaliações da comunidade PipocaCentral.`,
    canonical,
    ogType: "video.movie",
    ogImage: imageUrl(m.posterPath, "w500"),
    ld,
    body,
  };
}

function seasonsSection(seasons) {
  const list = (seasons || []).filter((s) => s.number > 0 || s.episodeCount);
  if (!list.length) return "";
  const html = list
    .map((s, i) => {
      const eps = (s.episodes || []).length
        ? `<ul style="margin-top:var(--space-4); display:flex; flex-direction:column; gap:var(--space-3)">${s.episodes
            .map((e) => `<li style="display:flex; justify-content:space-between; gap:var(--space-3); font-size:var(--fs-sm); color:var(--text-secondary); border-top:1px solid var(--border-subtle); padding-top:var(--space-3)"><span>${esc(e.number)}. ${esc(e.name || `Episódio ${e.number}`)}</span><span>${e.runtime ? `${esc(e.runtime)} min` : ""}</span></li>`)
            .join("")}</ul>`
        : `<p style="margin-top:var(--space-4); font-size:var(--fs-sm)">${s.episodeCount ? pluralize(s.episodeCount, "episódio", "episódios") : "Episódios em breve."}</p>`;
      return `<details class="panel" style="margin-bottom:var(--space-3)"${i === 0 ? " open" : ""}>
  <summary style="cursor:pointer; font-weight:700; display:flex; justify-content:space-between; align-items:center">${esc(s.name || `Temporada ${s.number}`)} <span class="icon" data-icon="chevronDown" style="width:1em"></span></summary>${eps}</details>`;
    })
    .join("");
  return `<h2 style="margin-top:var(--space-8)">Temporadas e episódios</h2>${html}`;
}

export function seriesPage(s, { origin, related = [], news = [], linkable = new Set() }) {
  const trail = [{ label: "Início", href: "/" }, { label: "Séries", href: "/busca?tipo=serie" }, { label: s.title }];
  const live = /exibi/i.test(s.statusText || "");
  const pills = `<span class="pill pill-brand">Série</span>${s.statusText ? `<span class="pill${live ? " pill-live" : ""}">${esc(s.statusText)}</span>` : ""}`;
  const facts = [
    fact("ticket", s.yearsText || s.year),
    fact("tv", s.seasonsCount ? pluralize(s.seasonsCount, "temporada", "temporadas") : ""),
    fact("user", (s.creators || [])[0] ? s.creators.join(", ") : ""),
  ].join("");
  const body = `<main id="main" data-type="series" data-slug="${esc(s.slug)}" data-title="${esc(s.title)}"${mediaData(s)}>
${mediaHero(s, { type: "series", trail, pills, facts })}
  <div class="container">
    <div class="grid-2 section-tight">
      <aside>
        ${platformsPanel(s.platforms)}
        ${techPanel([["Criação", s.creators], ["País", s.country], ["Duração por episódio", s.episodeRuntime ? `~${s.episodeRuntime} min` : ""], ["Classificação", s.certification], ["Título original", s.originalTitle && s.originalTitle !== s.title ? s.originalTitle : ""]])}
      </aside>
      <div>
        <h2>Sinopse</h2>
        <p class="lead">${esc(s.synopsis || "Sinopse em breve.")}</p>
        ${seasonsSection(s.seasons)}
        ${castSection(s.cast, linkable)}
        ${ratingSection(s)}
        ${commentsSection()}
      </div>
    </div>
    ${relatedSection("Séries parecidas", related, "related-series")}
    ${newsSection(news)}
  </div>
</main>`;
  const canonical = `${origin}/series/${s.slug}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "TVSeries",
      name: s.title,
      description: clip(s.synopsis, 300) || undefined,
      image: imageUrl(s.posterPath, "w500") || undefined,
      startDate: s.releaseDate || undefined,
      numberOfSeasons: s.seasonsCount || undefined,
      actor: (s.cast || []).slice(0, 8).map((c) => ({ "@type": "Person", name: c.name })),
      genre: s.genres,
      aggregateRating: ratingLd(s),
    },
    breadcrumbLd(origin, [{ label: "Início", href: "/" }, { label: "Séries", href: "/busca?tipo=serie" }, { label: s.title, href: `/series/${s.slug}` }]),
  ];
  return {
    title: `${s.title}${s.yearsText ? ` (${s.yearsText})` : ""} — Temporadas, elenco e onde assistir | PipocaCentral`,
    description: clip(s.synopsis) || `${s.title}: temporadas, elenco e onde assistir.`,
    canonical,
    ogType: "video.tv_show",
    ogImage: imageUrl(s.posterPath, "w500"),
    ld,
    body,
  };
}

export function personPage(p, { origin, existing = [], others = [], news = [] }) {
  const trail = [{ label: "Início", href: "/" }, { label: "Elenco", href: "/busca?tipo=pessoa" }, { label: p.name }];
  const photo = imageUrl(p.photoPath, "w342");
  const photoHtml = photo
    ? `<img src="${esc(photo)}" alt="Foto de ${esc(p.name)}" loading="lazy" decoding="async">`
    : esc(initialOf(p.name));
  const known = existing.length
    ? `<h2 style="margin-top:var(--space-7)">Filmografia</h2><div class="card-grid">${existing.map(cardTitle).join("")}</div>`
    : "";
  const more = others.length
    ? `<h2 style="margin-top:var(--space-7)">Também em</h2><ul style="display:flex; flex-direction:column; gap:var(--space-2); color:var(--text-secondary); font-size:var(--fs-sm)">${others.slice(0, 20).map((o) => `<li>${esc(o.title)}${o.year ? ` (${esc(o.year)})` : ""}</li>`).join("")}</ul>`
    : "";
  const body = `<main id="main" data-type="person" data-slug="${esc(p.slug)}">
  <div class="container section-tight">
    ${crumbs(trail)}
    <div class="grid-2">
      <aside>
        <div class="card-person-photo" style="${posterStyle(p)}; width:220px; aspect-ratio:1; font-size:3rem;">${photoHtml}</div>
        ${infoPanel([["Profissão", p.role], ["Nascimento", p.born], ["Nacionalidade", p.nationality]])}
      </aside>
      <div>
        <h1>${esc(p.name)}</h1>
        <p class="lead" style="margin-top:var(--space-3)">${esc(p.bio || "Biografia em breve.")}</p>
        ${known}
        ${more}
        ${news.length ? `<h2 style="margin-top:var(--space-8)">Notícias relacionadas</h2><div class="card-grid news">${news.map((n) => cardNews(n)).join("")}</div>` : ""}
      </div>
    </div>
  </div>
</main>`;
  const canonical = `${origin}/elenco/${p.slug}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: p.name,
      description: clip(p.bio, 300) || undefined,
      image: photo || undefined,
      birthDate: p.born || undefined,
      nationality: p.nationality || undefined,
      jobTitle: p.role || undefined,
    },
    breadcrumbLd(origin, [{ label: "Início", href: "/" }, { label: "Elenco", href: "/busca?tipo=pessoa" }, { label: p.name, href: `/elenco/${p.slug}` }]),
  ];
  return {
    title: `${p.name} — Biografia e filmografia | PipocaCentral`,
    description: clip(p.bio) || `${p.name}: biografia e filmografia.`,
    canonical,
    ogType: "profile",
    ogImage: photo,
    ld,
    body,
    pageScript: "/js/pages/base.js",
  };
}

function relatedTitlesChips(items) {
  if (!items || !items.length) return "";
  return `<div style="display:flex; gap:var(--space-2); flex-wrap:wrap; margin-top:var(--space-6)">${items
    .map((i) => `<a class="pill" href="${i.type === "series" ? "/series/" : "/filmes/"}${esc(i.slug)}">${esc(i.title)}</a>`)
    .join("")}</div>`;
}

export function newsPage(n, { origin, related = [] }) {
  const trail = [{ label: "Início", href: "/" }, { label: "Notícias", href: "/noticias" }, { label: n.title }];
  const cover = imageUrl(n.coverUrl, "w780");
  const date = formatDateBR(n.publishedAt);
  const body = `<main id="main" data-type="news" data-slug="${esc(n.slug)}">
  <article class="container-narrow section-tight">
    ${crumbs(trail)}
    <span class="pill pill-brand">${esc(n.category || "Notícia")}</span>
    <h1 style="margin-top:var(--space-3); font-size:var(--fs-2xl)">${esc(n.title)}</h1>
    <div class="meta" style="margin-top:var(--space-3); color:var(--text-secondary); font-size:var(--fs-sm)">${esc([n.author, date].filter(Boolean).join(" · "))}</div>
    ${cover ? `<img src="${esc(cover)}" alt="" style="margin-top:var(--space-5); border-radius:var(--radius-md); width:100%" decoding="async">` : ""}
    <div class="prose article-body" style="margin-top:var(--space-5)">${renderMarkdown(n.body)}</div>
    ${relatedTitlesChips(n.relatedTitles)}
  </article>
  ${related.length ? `<div class="container section-tight"><div class="section-header"><h2>Continue lendo</h2></div><div class="card-grid news">${related.map((r) => cardNews(r)).join("")}</div></div>` : ""}
</main>`;
  const canonical = `${origin}/noticias/${n.slug}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: n.title,
      datePublished: n.publishedAt || undefined,
      dateModified: n.updatedAt || n.publishedAt || undefined,
      author: { "@type": "Person", name: n.author || "Equipe PipocaCentral" },
      image: cover || undefined,
      description: clip(n.excerpt, 300) || undefined,
    },
    breadcrumbLd(origin, [{ label: "Início", href: "/" }, { label: "Notícias", href: "/noticias" }, { label: n.title, href: `/noticias/${n.slug}` }]),
  ];
  return {
    title: `${n.title} | PipocaCentral`,
    description: clip(n.excerpt || n.body),
    canonical,
    ogType: "article",
    ogImage: cover,
    ld,
    body,
    pageScript: "/js/pages/base.js",
  };
}

function bulletList(title, items, tone) {
  if (!items || !items.length) return "";
  return `<div class="panel" style="flex:1; min-width:240px"><h3 style="font-size:var(--fs-sm); color:${tone}; margin-bottom:var(--space-3)">${esc(title)}</h3><ul style="display:flex; flex-direction:column; gap:var(--space-2); font-size:var(--fs-sm)">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;
}

export function reviewPage(r, { origin, target = null }) {
  const trail = [{ label: "Início", href: "/" }, { label: "Análises", href: "/analises" }, { label: r.title }];
  const date = formatDateBR(r.publishedAt);
  const link = target ? `${target.type === "series" ? "/series/" : "/filmes/"}${target.slug}` : "";
  const body = `<main id="main" data-type="review" data-slug="${esc(r.slug)}">
  <article class="container-narrow section-tight">
    ${crumbs(trail)}
    <span class="pill pill-brand">Análise</span>
    <h1 style="margin-top:var(--space-3); font-size:var(--fs-2xl)">${esc(r.title)}</h1>
    <div class="fact-row" style="margin-top:var(--space-3)">
      ${r.score ? `<span class="fact"><span class="icon" data-icon="star"></span>Nota ${esc(Number(r.score).toFixed(1))}/5</span>` : ""}
      ${r.targetTitle ? `<span class="fact"><span class="icon" data-icon="film"></span>${link ? `<a href="${esc(link)}">${esc(r.targetTitle)}</a>` : esc(r.targetTitle)}</span>` : ""}
      ${r.author || date ? `<span class="fact">${esc([r.author, date].filter(Boolean).join(" · "))}</span>` : ""}
    </div>
    <div class="prose article-body" style="margin-top:var(--space-5)">${renderMarkdown(r.body)}</div>
    <div style="display:flex; gap:var(--space-4); flex-wrap:wrap; margin-top:var(--space-6)">
      ${bulletList("Pontos positivos", r.pros, "var(--color-success)")}
      ${bulletList("Pontos negativos", r.cons, "var(--color-error)")}
    </div>
    ${r.spoilerBody ? `<details class="panel" style="margin-top:var(--space-6)"><summary style="cursor:pointer; font-weight:700">Área com spoilers — clique para abrir</summary><div class="prose article-body" style="margin-top:var(--space-4)">${renderMarkdown(r.spoilerBody)}</div></details>` : ""}
  </article>
</main>`;
  const canonical = `${origin}/analises/${r.slug}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Review",
      name: r.title,
      datePublished: r.publishedAt || undefined,
      author: { "@type": "Person", name: r.author || "Equipe PipocaCentral" },
      itemReviewed: r.targetTitle ? { "@type": r.targetType === "series" ? "TVSeries" : "Movie", name: r.targetTitle } : undefined,
      reviewRating: r.score ? { "@type": "Rating", ratingValue: String(r.score), bestRating: "5", worstRating: "1" } : undefined,
      reviewBody: clip(r.body, 400) || undefined,
    },
    breadcrumbLd(origin, [{ label: "Início", href: "/" }, { label: "Análises", href: "/analises" }, { label: r.title, href: `/analises/${r.slug}` }]),
  ];
  return {
    title: `${r.title} | Análises | PipocaCentral`,
    description: clip(r.excerpt || r.body),
    canonical,
    ogType: "article",
    ogImage: imageUrl(r.coverUrl, "w780"),
    ld,
    body,
    pageScript: "/js/pages/base.js",
  };
}

export function listPage(l, { origin, entries = [] }) {
  const trail = [{ label: "Início", href: "/" }, { label: "Listas", href: "/listas" }, { label: l.title }];
  const items = entries
    .map(
      (e, i) => `<li style="display:flex; align-items:center; gap:var(--space-5); background:var(--bg-card); border-radius:var(--radius-md); padding:var(--space-4)">
  <span style="font-size:var(--fs-xl); font-weight:800; color:var(--text-secondary); min-width:2ch; text-align:center">${i + 1}</span>
  <div class="card-poster-art" style="${posterStyle(e)}; width:56px; flex-shrink:0">${posterInner(e, "w154")}</div>
  <a href="${e.type === "series" ? "/series/" : "/filmes/"}${esc(e.slug)}" style="flex:1; min-width:0">
    <h3 style="font-size:var(--fs-sm)">${esc(e.title)}</h3>
    <div class="meta" style="color:var(--text-secondary); font-size:var(--fs-xs)">${esc([e.type === "series" ? "Série" : "Filme", e.year].filter(Boolean).join(" · "))}</div>
    ${e.note ? `<p style="font-size:var(--fs-xs); margin-top:var(--space-1)">${esc(e.note)}</p>` : ""}
  </a>
</li>`
    )
    .join("");
  const body = `<main id="main" data-type="list" data-slug="${esc(l.slug)}">
  <div class="container-narrow section-tight">
    ${crumbs(trail)}
    <h1 style="font-size:var(--fs-2xl)">${esc(l.title)}</h1>
    ${l.description ? `<p class="lead" style="margin-top:var(--space-3)">${esc(l.description)}</p>` : ""}
    <ol style="display:flex; flex-direction:column; gap:var(--space-3); margin-top:var(--space-6)">${items}</ol>
  </div>
</main>`;
  const canonical = `${origin}/listas/${l.slug}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: l.title,
      numberOfItems: entries.length,
      itemListElement: entries.map((e, i) => ({ "@type": "ListItem", position: i + 1, name: e.title, url: `${origin}${e.type === "series" ? "/series/" : "/filmes/"}${e.slug}` })),
    },
    breadcrumbLd(origin, [{ label: "Início", href: "/" }, { label: "Listas", href: "/listas" }, { label: l.title, href: `/listas/${l.slug}` }]),
  ];
  return {
    title: `${l.title} | Listas | PipocaCentral`,
    description: clip(l.description) || `${l.title} — uma lista do PipocaCentral.`,
    canonical,
    ogType: "website",
    ogImage: imageUrl(l.coverUrl, "w780"),
    ld,
    body,
    pageScript: "/js/pages/base.js",
  };
}
