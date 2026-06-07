import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initAuth } from '@myorg/auth-google';
import App from './App.tsx';
import './index.css';

// Reviewer fix N4: browser error tracking. No-op in local dev (init skipped
// when VITE_SENTRY_DSN is unset).
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

// M10.1: initialise Firebase auth once at app entry, before any component reads
// useAuth(). Config comes from the VITE_FIREBASE_* build-time env vars. The
// optional storage/messaging fields are passed through when present.
initAuth({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
