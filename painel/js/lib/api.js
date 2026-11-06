import { auth } from "../firebase.js";
import { PANEL_CONFIG } from "../config.js";

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || data.status_message || `Erro ${response.status}`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function bearer() {
  return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
}

export async function adminApi(action, payload = {}) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await bearer()) },
    body: JSON.stringify({ action, ...payload }),
  });
  return parse(response);
}

export function apiWorkerReady() {
  return /^https:\/\//.test(PANEL_CONFIG.apiWorkerUrl);
}

export async function workerApi(path, { method = "GET", body } = {}) {
  if (!apiWorkerReady()) {
    throw new Error("A URL do Worker API ainda não foi colocada em painel/js/config.js (apiWorkerUrl).");
  }
  const response = await fetch(`${PANEL_CONFIG.apiWorkerUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(await bearer()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return parse(response);
}

export async function tmdb(path, params = {}) {
  const url = new URL(`${PANEL_CONFIG.tmdbWorkerUrl.replace(/\/+$/, "")}/tmdb/${path}`);
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && url.searchParams.set(k, v));
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.status_message || `TMDB respondeu ${response.status}`);
  return data;
}

export async function health(url) {
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
