import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import type { AuthConfig } from './types';

let auth: Auth | null = null;

export function initAuth(config: AuthConfig): void {
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    throw new Error('@myorg/auth-google: call initAuth(config) before using auth features.');
  }
  return auth;
}
