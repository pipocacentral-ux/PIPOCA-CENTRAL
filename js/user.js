import { db } from "./firebase-init.js";
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, collection, getDocs, query, where, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { CONFIG } from "./config.js";
import { plain } from "./data.js";

function itemId(type, slug) {
  return `${type}_${slug}`;
}

const pending = new Map();

async function createUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const name = (user.displayName || (user.email || "").split("@")[0] || "Usuário").slice(0, 40);
  const data = {
    displayName: name,
    avatarUrl: String(user.photoURL || "").startsWith("https://") ? user.photoURL.slice(0, 300) : "",
    createdAt: serverTimestamp(),
    termsAcceptedAt: serverTimestamp(),
    minAge: CONFIG.minAge,
  };
  await setDoc(ref, data);
  return data;
}

export function ensureUserDoc(user) {
  if (!pending.has(user.uid)) {
    const job = createUserDoc(user).finally(() => pending.delete(user.uid));
    pending.set(user.uid, job);
  }
  return pending.get(user.uid);
}

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, { displayName, avatarUrl }) {
  await updateDoc(doc(db, "users", uid), { displayName: displayName.slice(0, 40), avatarUrl: avatarUrl || "" });
}

export async function getListState(uid, type, slug) {
  const id = itemId(type, slug);
  const [fav, later] = await Promise.all([
    getDoc(doc(db, "users", uid, "favorites", id)),
    getDoc(doc(db, "users", uid, "watchlist", id)),
  ]);
  return { favorite: fav.exists(), watchlist: later.exists() };
}

export async function setListItem(uid, listName, item, on) {
  const ref = doc(db, "users", uid, listName, itemId(item.type, item.slug));
  if (!on) return deleteDoc(ref);
  return setDoc(ref, {
    type: item.type,
    slug: item.slug,
    title: String(item.title || "").slice(0, 200),
    posterPath: item.posterPath || "",
    color: item.color || null,
    year: item.year || null,
    addedAt: serverTimestamp(),
  });
}

export async function loadUserList(uid, listName) {
  const snap = await getDocs(query(collection(db, "users", uid, listName), orderBy("addedAt", "desc"), limit(120)));
  return snap.docs.map(plain);
}

export async function getMyRating(uid, type, slug) {
  const snap = await getDoc(doc(db, "ratings", `${type}_${slug}_${uid}`));
  return snap.exists() ? Number(snap.data().value) : 0;
}

export async function loadMyRatings(uid) {
  const snap = await getDocs(query(collection(db, "ratings"), where("uid", "==", uid), limit(200)));
  return snap.docs.map(plain);
}

export async function loadAvatars() {
  const snap = await getDocs(query(collection(db, "avatars"), orderBy("order", "asc"), limit(80)));
  return snap.docs.map(plain);
}
