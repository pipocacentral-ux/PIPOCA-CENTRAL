import { esc, jsonLd } from "../js/shared/util.js";
import { HEADER, FOOTER } from "./partials.js";

export function layout({ title, description, canonical, ogType = "website", ogImage = "", ld = [], body, noindex = false, pageScript = "/js/pages/detail.js", status }) {
  const meta = [
    `<meta charset="UTF-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}">` : "",
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : "",
    noindex ? `<meta name="robots" content="noindex">` : "",
    `<meta property="og:title" content="${esc(title)}">`,
    description ? `<meta property="og:description" content="${esc(description)}">` : "",
    `<meta property="og:type" content="${esc(ogType)}">`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}">` : "",
    ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : "",
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">`,
    `<link rel="stylesheet" href="/css/tokens.css">`,
    `<link rel="stylesheet" href="/css/base.css">`,
    `<link rel="stylesheet" href="/css/components.css">`,
    ...ld.map((item) => `<script type="application/ld+json">${jsonLd(item)}</script>`),
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${meta.join("\n")}
</head>
<body>
${HEADER}

${body}

${FOOTER}

<script src="/js/main.js" defer></script>
<script type="module" src="${esc(pageScript)}"></script>
</body>
</html>`;
}

export function notFoundBody() {
  return `<main id="main">
  <div class="container coming-soon">
    <div class="icon-badge"><span class="icon" data-icon="search"></span></div>
    <h1 style="font-size:var(--fs-xl)">Não encontramos essa página</h1>
    <p>O link pode estar errado ou o conteúdo pode ter saído do ar. Que tal buscar o que você procurava?</p>
    <a href="/busca" class="btn btn-primary">Ir para a busca</a>
  </div>
</main>`;
}
