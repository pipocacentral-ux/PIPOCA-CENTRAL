import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAgA3H7TxjJrEDDOdaxQht_EoB8e-OTsTg",
  authDomain: "pipoca-central.firebaseapp.com",
  projectId: "pipoca-central",
  storageBucket: "pipoca-central.firebasestorage.app",
  messagingSenderId: "571335962145",
  appId: "1:571335962145:web:e1ee9e0feb63324051fd60",
  measurementId: "G-WVEBNDL28L",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = "pt-BR";
export const db = getFirestore(app);

let analyticsStarted = false;

export async function startAnalytics() {
  if (analyticsStarted) return;
  analyticsStarted = true;
  try {
    const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js");
    getAnalytics(app);
  } catch {
    analyticsStarted = false;
  }
}
