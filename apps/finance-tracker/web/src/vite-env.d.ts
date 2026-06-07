/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  // Firebase web config (M10.1). Required for Google sign-in; injected at build
  // time. Optional storage/messaging fields mirror the @myorg/auth-google
  // AuthConfig shape.
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID: string;
  // Optional explicit BFF base URL. When unset, the client uses same-origin
  // relative paths (`/api/*`) — prod serves the SPA from the BFF, and in dev
  // Vite's server.proxy forwards `/api` to the local BFF (M10.5).
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
