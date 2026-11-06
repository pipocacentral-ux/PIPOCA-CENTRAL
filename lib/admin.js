import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Variável FIREBASE_SERVICE_ACCOUNT não configurada");
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const json = JSON.parse(text);
  json.private_key = String(json.private_key).replace(/\\n/g, "\n");
  return json;
}

function app() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(loadCredentials()) });
}

export function getDb() {
  return getFirestore(app());
}

export function getAdminAuth() {
  return getAuth(app());
}

export { FieldValue, Timestamp };

export async function verifyRequest(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await getAdminAuth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

export function serializeValue(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeValue(v)]));
  }
  return value;
}

export function serializeDoc(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...serializeValue(snap.data()) };
}
