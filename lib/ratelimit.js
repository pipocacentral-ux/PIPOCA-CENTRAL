import { createHash } from "node:crypto";

export function hashKey(parts) {
  const salt = process.env.RATE_LIMIT_SALT || "pipocacentral";
  return createHash("sha256").update(`${salt}|${parts.join("|")}`).digest("hex").slice(0, 40);
}

export async function hit(db, key, limit, windowSeconds) {
  const ref = db.collection("rateLimits").doc(key);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    let data = snap.exists ? snap.data() : null;
    if (!data || data.resetAt <= now) data = { count: 0, resetAt: now + windowSeconds * 1000 };
    if (data.count >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((data.resetAt - now) / 1000)) };
    }
    tx.set(ref, {
      count: data.count + 1,
      resetAt: data.resetAt,
      expireAt: new Date(data.resetAt + 3600 * 1000),
    });
    return { ok: true };
  });
}
