import { esc } from "./util.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function toast(message, kind = "info") {
  const box = document.getElementById("toasts");
  const item = document.createElement("div");
  item.className = `toast-item toast-${kind}`;
  item.textContent = message;
  box.appendChild(item);
  setTimeout(() => item.remove(), kind === "error" ? 7000 : 3800);
}

export function openModal({ title, body, wide = false, onClose }) {
  const modal = document.createElement("div");
  modal.className = "pmodal";
  modal.innerHTML = `<div class="pmodal-scrim" data-close></div>
    <div class="pmodal-panel${wide ? " is-wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="pmodal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">✕</button></div>
      <div class="pmodal-body"></div>
    </div>`;
  const slot = modal.querySelector(".pmodal-body");
  if (typeof body === "string") slot.innerHTML = body;
  else slot.appendChild(body);
  const previous = document.activeElement;
  const close = () => {
    modal.remove();
    document.removeEventListener("keydown", onKey);
    previous?.focus?.();
    onClose?.();
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  modal.addEventListener("click", (e) => e.target.closest("[data-close]") && close());
  document.body.appendChild(modal);
  const first = modal.querySelector("input, textarea, select, button:not([data-close])");
  first?.focus();
  return { el: modal, body: slot, close };
}

export function confirmBox(message, confirmLabel = "Confirmar", danger = false) {
  return new Promise((resolve) => {
    const body = document.createElement("div");
    body.innerHTML = `<p style="margin-bottom:var(--space-5)">${esc(message)}</p>
      <div class="row-end"><button type="button" class="btn btn-secondary" data-no>Cancelar</button>
      <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(confirmLabel)}</button></div>`;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modal.close();
      resolve(value);
    };
    const modal = openModal({ title: "Confirmação", body, onClose: () => finish(false) });
    body.querySelector("[data-no]").addEventListener("click", () => finish(false));
    body.querySelector("[data-yes]").addEventListener("click", () => finish(true));
  });
}

export function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    if (label) button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}

export function fieldHtml(field, value) {
  const id = `f-${field.name}`;
  const label = `<label for="${id}">${esc(field.label)}${field.required ? " *" : ""}</label>`;
  const hint = field.hint ? `<span class="field-hint">${esc(field.hint)}</span>` : "";
  const ai = field.ai ? `<button type="button" class="btn btn-secondary btn-sm ai-btn" data-ai="${esc(field.ai)}" data-target="${esc(field.name)}">Gerar com IA</button>` : "";
  const attrs = `id="${id}" name="${esc(field.name)}"${field.required ? " required" : ""}`;
  let control;
  if (field.type === "textarea") control = `<textarea ${attrs} rows="${field.rows || 5}">${esc(value ?? "")}</textarea>`;
  else if (field.type === "select") {
    control = `<select ${attrs}>${field.options.map((o) => `<option value="${esc(o.value ?? o)}"${String(value ?? "") === String(o.value ?? o) ? " selected" : ""}>${esc(o.label ?? o)}</option>`).join("")}</select>`;
  } else if (field.type === "tags") control = `<input ${attrs} type="text" value="${esc(Array.isArray(value) ? value.join(", ") : value ?? "")}">`;
  else if (field.type === "lines") control = `<textarea ${attrs} rows="${field.rows || 4}">${esc(Array.isArray(value) ? value.join("\n") : value ?? "")}</textarea>`;
  else if (field.type === "json") control = `<textarea ${attrs} rows="${field.rows || 6}" spellcheck="false" class="mono">${esc(value === undefined || value === null || value === "" ? "" : JSON.stringify(value, null, 2))}</textarea>`;
  else if (field.type === "number") control = `<input ${attrs} type="number" step="any" value="${esc(value ?? "")}">`;
  else if (field.type === "date") control = `<input ${attrs} type="date" value="${esc(value ?? "")}">`;
  else control = `<input ${attrs} type="${field.type === "url" ? "url" : "text"}" value="${esc(value ?? "")}">`;
  return `<div class="field${field.full ? " is-full" : ""}">${label}${control}${hint}${ai}</div>`;
}

export function readField(field, form) {
  const el = form.elements[field.name];
  const raw = el ? el.value : "";
  switch (field.type) {
    case "number": {
      if (raw === "") return null;
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`“${field.label}” precisa ser um número.`);
      return n;
    }
    case "tags":
      return raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    case "lines":
      return raw.split("\n").map((t) => t.trim()).filter(Boolean);
    case "json": {
      if (!raw.trim()) return field.emptyAs ?? [];
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`“${field.label}” não é um JSON válido. Confira vírgulas e aspas.`);
      }
    }
    default:
      return raw.trim();
  }
}

export function readForm(fields, form) {
  const out = {};
  for (const field of fields) {
    const value = readField(field, form);
    if (field.required && (value === "" || value === null || (Array.isArray(value) && !value.length))) {
      throw new Error(`Preencha “${field.label}”.`);
    }
    out[field.name] = value;
  }
  return out;
}

export function formatTs(value) {
  if (!value) return "";
  const d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function emptyState(text) {
  return `<div class="empty">${esc(text)}</div>`;
}
