import { normalize } from "../js/shared/util.js";

const BLOCKED_TERMS = ["porra", "caralho", "fdp", "filho da puta", "buceta", "viado", "vadia", "arrombado", "cuzao", "nazista"];

export function needsReview(text) {
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|io|xyz|ru|co)\b)/i.test(text)) return true;
  const padded = ` ${normalize(text)} `;
  return BLOCKED_TERMS.some((term) => padded.includes(` ${term} `));
}
