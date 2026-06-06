import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Service account JSON is provided at runtime via FIREBASE_SERVICE_ACCOUNT and
// is NEVER committed. Tests mock this whole module, so this only runs in real
// server processes. getApps() guards against double-init (HMR / repeated import).
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
if (getApps().length === 0) {
  initializeApp({ credential: cert(sa) });
}

export const firebaseAuth = getAuth();
