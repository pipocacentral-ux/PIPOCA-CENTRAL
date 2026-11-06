import { esc } from "../lib/util.js";
import { $, toast, setBusy } from "../lib/ui.js";
import { workerApi } from "../lib/api.js";

const TASKS = [
  ["chat", "Pergunta livre"],
  ["synopsis", "Sinopse curta"],
  ["news", "Rascunho de notícia"],
  ["review", "Rascunho de análise"],
  ["seo", "Título e descrição para o Google"],
  ["rewrite", "Reescrever um texto"],
];

export function mountAssistant(root) {
  root.innerHTML = `
    <form class="assistant" data-form>
      <div class="field"><label for="ai-task">O que você quer fazer?</label><select id="ai-task">${TASKS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>
      <div class="field"><label for="ai-prompt">Pedido</label><textarea id="ai-prompt" rows="5" required placeholder="Ex.: sinopse de Duna: Parte Dois, sem spoilers"></textarea></div>
      <div class="field"><label for="ai-context">Dados de apoio (opcional)</label><textarea id="ai-context" rows="4" placeholder="Elenco, direção, trechos de fatos que você já confirmou..."></textarea><span class="field-hint">O assistente não pesquisa na internet: confira nomes, datas e números antes de publicar. Trechos marcados com [VERIFICAR] pedem checagem.</span></div>
      <p class="form-error" data-error role="alert"></p>
      <button type="submit" class="btn btn-primary">Gerar texto</button>
    </form>
    <section data-out hidden class="panel-box"><div class="h2-row"><h2 class="h2">Resultado</h2><button type="button" class="btn btn-secondary btn-sm" data-copy>Copiar</button></div><pre class="ai-output" data-text></pre></section>`;

  $("[data-form]", root).addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("button[type=submit]", root);
    const errorEl = $("[data-error]", root);
    errorEl.textContent = "";
    setBusy(button, true, "Gerando...");
    try {
      const result = await workerApi("/gemini/generate", {
        method: "POST",
        body: { task: $("#ai-task", root).value, prompt: $("#ai-prompt", root).value, context: $("#ai-context", root).value },
      });
      $("[data-text]", root).textContent = result.text;
      $("[data-out]", root).hidden = false;
    } catch (error) {
      errorEl.textContent = error.message;
    } finally {
      setBusy(button, false);
    }
  });

  $("[data-copy]", root).addEventListener("click", async () => {
    await navigator.clipboard.writeText($("[data-text]", root).textContent);
    toast("Texto copiado.");
  });
}
