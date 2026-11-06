import { db } from "./firebase-init.js";
import {
  collection, query, where, orderBy, limit, getDocs, getDoc, doc, startAfter,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { queryToken, matchesQuery, normalize } from "./shared/util.js";

const TYPES = { movies: "movie", series: "series", people: "person" };
const DATE_FIELDS = ["createdAt", "updatedAt", "publishedAt"];

export function plain(snap) {
  const data = snap.data();
  const out = { id: snap.id, slug: data.slug || snap.id, ...data };
  for (const field of DATE_FIELDS) {
    if (out[field] && typeof out[field].toDate === "function") out[field] = out[field].toDate().toISOString();
  }
  return out;
}

function withType(col, docs) {
  return TYPES[col] ? docs.map((d) => ({ ...d, type: TYPES[col] })) : docs;
}

async function run(q, col) {
  const snap = await getDocs(q);
  return withType(col, snap.docs.map(plain));
}

export function published(col, order, direction = "desc", max = 24) {
  return run(query(collection(db, col), where("status", "==", "published"), orderBy(order, direction), limit(max)), col);
}

export async function searchCollection(col, text, max = 40) {
  const token = queryToken(text);
  const wanted = normalize(text);
  const base = collection(db, col);
  let docs;
  if (token) {
    docs = await run(query(base, where("status", "==", "published"), where("searchTokens", "array-contains", token), limit(120)), col);
  } else {
    docs = await run(query(base, where("status", "==", "published"), orderBy("popularity", "desc"), limit(wanted ? 120 : max)), col);
  }
  if (wanted) docs = docs.filter((d) => matchesQuery(d.titleNorm || normalize(d.title || d.name), text));
  return docs.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, max);
}

export async function fetchOne(col, id) {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? withType(col, [plain(snap)])[0] : null;
}

export async function fetchComments(type, slug, cursor = null, max = 20) {
  const constraints = [
    where("targetKey", "==", `${type}_${slug}`),
    where("status", "==", "visible"),
    orderBy("createdAt", "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(max));
  const snap = await getDocs(query(collection(db, "comments"), ...constraints));
  return {
    items: snap.docs.map(plain),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === max,
  };
}
