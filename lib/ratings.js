import { FieldValue } from "./admin.js";
import { HttpError } from "./http.js";

const PRIOR_MEAN = 3.8;
const PRIOR_WEIGHT = 5;

export function aggregate(sum, count) {
  const avg = count > 0 ? sum / count : 0;
  const rank = count > 0 ? (count / (count + PRIOR_WEIGHT)) * avg + (PRIOR_WEIGHT / (count + PRIOR_WEIGHT)) * PRIOR_MEAN : 0;
  return { ratingAvg: Math.round(avg * 10) / 10, rankScore: Math.round(rank * 1000) / 1000 };
}

export function collectionFor(type) {
  return type === "series" ? "series" : "movies";
}

export function emptyDist() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

export async function applyRating(db, { type, slug, uid, value, tolerateMissing = false }) {
  const targetRef = db.collection(collectionFor(type)).doc(slug);
  const ratingRef = db.collection("ratings").doc(`${type}_${slug}_${uid}`);

  return db.runTransaction(async (tx) => {
    const [target, previous] = await Promise.all([tx.get(targetRef), tx.get(ratingRef)]);
    if (!target.exists || (target.data().status !== "published" && value > 0)) {
      if (tolerateMissing) {
        if (previous.exists) tx.delete(ratingRef);
        return null;
      }
      throw new HttpError(404, "Título não encontrado", "not-found");
    }
    const data = target.data();
    const old = previous.exists ? Number(previous.data().value) : 0;
    const dist = { ...emptyDist(), ...(data.ratingDist || {}) };
    let sum = Number(data.ratingSum) || 0;
    let count = Number(data.ratingCount) || 0;

    if (old) {
      sum -= old;
      count -= 1;
      dist[old] = Math.max(0, (dist[old] || 0) - 1);
    }
    if (value) {
      sum += value;
      count += 1;
      dist[value] = (dist[value] || 0) + 1;
    }
    const computed = aggregate(sum, count);
    tx.update(targetRef, { ratingSum: sum, ratingCount: count, ratingDist: dist, ...computed });

    if (value) {
      tx.set(ratingRef, {
        type,
        slug,
        uid,
        value,
        title: data.title || "",
        posterPath: data.posterPath || "",
        color: data.color || null,
        year: data.year || null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (previous.exists) {
      tx.delete(ratingRef);
    }
    return { ratingSum: sum, ratingCount: count, ratingDist: dist, ...computed, mine: value };
  });
}
