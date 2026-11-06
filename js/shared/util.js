export const TMDB_IMG = "https://image.tmdb.org/t/p";
export const DEFAULT_COLORS = ["#2b2140", "#171821"];

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(value) {
  return normalize(value).replace(/\s+/g, "-").slice(0, 90).replace(/-+$/, "");
}

export function searchTokens(...texts) {
  const words = normalize(texts.filter(Boolean).join(" ")).split(" ").filter(Boolean);
  const tokens = new Set();
  for (const word of words) {
    const capped = word.slice(0, 20);
    if (capped.length === 1) tokens.add(capped);
    for (let i = 2; i <= capped.length; i++) tokens.add(capped.slice(0, i));
    if (tokens.size >= 150) break;
  }
  return [...tokens].slice(0, 150);
}

export function queryToken(query) {
  const words = normalize(query).split(" ").filter((w) => w.length >= 2);
  if (!words.length) return "";
  return words.sort((a, b) => b.length - a.length)[0].slice(0, 20);
}

export function matchesQuery(titleNorm, query) {
  const words = normalize(query).split(" ").filter(Boolean);
  return words.every((w) => titleNorm.includes(w));
}

export function imageUrl(path, size = "w342") {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${TMDB_IMG}/${size}${path}`;
}

export function colorPair(doc) {
  const c = doc && Array.isArray(doc.color) && doc.color.length === 2 ? doc.color : DEFAULT_COLORS;
  return c.map((v) => (/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : "#171821"));
}

export function formatDuration(minutes) {
  const m = Math.round(Number(minutes));
  if (!m || m < 1) return "";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}min`;
  return rest ? `${h}h ${rest}min` : `${h}h`;
}

export function isoDuration(minutes) {
  const m = Math.round(Number(minutes));
  if (!m || m < 1) return "";
  return `PT${Math.floor(m / 60)}H${m % 60}M`;
}

export function formatDateBR(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function timeAgo(value, now = Date.now()) {
  const t = new Date(value).getTime();
  if (!t) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "agora há pouco";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `há ${mo} ${mo === 1 ? "mês" : "meses"}`;
  const y = Math.round(mo / 12);
  return `há ${y} ${y === 1 ? "ano" : "anos"}`;
}

export function ratingLabel(doc) {
  const n = Number(doc && doc.ratingCount) || 0;
  const avg = Number(doc && doc.ratingAvg) || 0;
  return n > 0 && avg > 0 ? avg.toFixed(1) : "";
}

export function initialOf(text) {
  const t = String(text || "").trim();
  return t ? Array.from(t)[0].toUpperCase() : "?";
}

export function pluralize(n, one, many) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

export function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
