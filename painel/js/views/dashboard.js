import { esc } from "../lib/util.js";
import { $, toast } from "../lib/ui.js";
import { adminApi, workerApi, apiWorkerReady, health, tmdb } from "../lib/api.js";
import { PANEL_CONFIG } from "../config.js";

const CARDS = [
  ["movies", "Filmes", "#/filmes"],
  ["series", "Séries", "#/series"],
  ["people", "Pessoas", "#/elenco"],
  ["news", "Notícias", "#/noticias"],
  ["reviews", "Análises", "#/analises"],
  ["lists", "Listas", "#/listas"],
  ["users", "Usuários", "#/equipe"],
  ["commentsPending", "Comentários em revisão", "#/comentarios"],
  ["commentsFlagged", "Comentários denunciados", "#/comentarios"],
  ["messagesNew", "Mensagens novas", "#/mensagens"],
];

async function checkConnections(box) {
  const rows = [];
  const add = (name, ok, detail) => rows.push(`<li class="${ok ? "ok" : "bad"}"><span class="dot"></span><strong>${esc(name)}</strong><span class="muted">${esc(detail)}</span></li>`);

  try {
    await tmdb("configuration");
    add("Worker do TMDB", true, "respondendo e com a chave configurada");
  } catch (error) {
    add("Worker do TMDB", false, error.message);
  }

  if (!apiWorkerReady()) {
    add("Worker API (planilha, e-mail, IA)", false, "falta colar a URL em painel/js/config.js");
  } else {
    const alive = await health(PANEL_CONFIG.apiWorkerUrl);
    add("Worker API", alive, alive ? "no ar" : "não respondeu — confira a URL e ALLOWED_ORIGINS");
    if (alive) {
      try {
        const sheet = await workerApi("/sheets/filmes?preview=1");
        add("Planilha do Google", true, `${sheet.total} filme(s) encontrados`);
      } catch (error) {
        add("Planilha do Google", false, error.message);
      }
    }
  }
  box.innerHTML = `<ul class="checks">${rows.join("")}</ul>`;
}

export async function mountDashboard(root) {
  root.innerHTML = `
    <section><h2 class="h2">Visão geral</h2><div class="stat-grid" data-stats><p class="muted">Carregando números...</p></div></section>
    <section><div class="h2-row"><h2 class="h2">Conexões</h2><button type="button" class="btn btn-secondary btn-sm" data-check>Verificar agora</button></div>
      <div data-checks class="panel-box"><p class="muted">Clique em “Verificar agora” para testar o TMDB, o Worker API e a planilha.</p></div></section>`;

  adminApi("stats")
    .then((s) => {
      $("[data-stats]", root).innerHTML = CARDS.map(([key, label, href]) => `<a class="stat" href="${href}"><span class="stat-num">${esc(s[key] ?? 0)}</span><span class="stat-label">${esc(label)}</span></a>`).join("");
    })
    .catch((error) => {
      $("[data-stats]", root).innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
    });

  $("[data-check]", root).addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const box = $("[data-checks]", root);
    box.innerHTML = `<p class="muted">Testando...</p>`;
    await checkConnections(box);
    button.disabled = false;
  });
}
