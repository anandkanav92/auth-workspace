# auth-workspace — One-Pager Guide

## What was built

A pnpm monorepo with a shared Firebase Google Auth package (`@myorg/auth-google`) that works across any React-based project — Next.js, Vite, React Native, etc.

```
auth-workspace/
  packages/
    auth-google/       ← shared package (build once, use everywhere)
  apps/
    demo-nextjs/       ← Next.js App Router demo (localhost:3001)
    demo-react/        ← Vite + React demo (localhost:5173)
```

---

## What `@myorg/auth-google` exports

| Export | Type | What it does |
|---|---|---|
| `initAuth(config)` | function | Initialize Firebase (call once at app root) |
| `signInWithGoogle()` | async function | Opens Google sign-in popup |
| `signOut()` | async function | Signs the user out |
| `getCurrentUser()` | function | Returns current user or null (sync) |
| `onAuthChange(cb)` | function | Subscribes to auth state changes |
| `useAuth()` | React hook | Returns `{ user, loading }` |
| `SignInButton` | Component | Button that triggers Google sign-in |
| `SignOutButton` | Component | Button that signs the user out |
| `UserAvatar` | Component | Shows user photo + display name |
| `AuthGuard` | Component | Renders children only when signed in |

---

## Adding auth to a new project

### Step 1 — Add the package dependency

In your new app's `package.json`:
```json
{
  "dependencies": {
    "@myorg/auth-google": "workspace:*",
    "firebase": "^11.0.0"
  }
}
```
Then run `pnpm install` from the workspace root.

### Step 2 — Add Firebase env vars

Create `.env.local` in your app:
```
# For Next.js — prefix with NEXT_PUBLIC_
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# For Vite — prefix with VITE_
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
...
```

Firebase config is in: **Firebase Console → Project Settings → Your apps → SDK setup**

### Step 3 — Initialize auth once at app root

**Next.js (App Router)** — create `src/lib/auth-provider.tsx`:
```tsx
'use client';
import { initAuth } from '@myorg/auth-google';

initAuth({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```
Then wrap your layout:
```tsx
// src/app/layout.tsx
import { AuthProvider } from '@/lib/auth-provider';
// ...
<body><AuthProvider>{children}</AuthProvider></body>
```
Add to `next.config.ts`:
```ts
transpilePackages: ['@myorg/auth-google']
```

**Vite + React** — initialize at the top of `App.tsx`:
```tsx
import { initAuth } from '@myorg/auth-google';

initAuth({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
```

### Step 4 — Use auth anywhere in the app

```tsx
import { useAuth, SignInButton, SignOutButton, UserAvatar, AuthGuard } from '@myorg/auth-google';

// Protect a page
<AuthGuard fallback={<SignInButton />}>
  <Dashboard />
</AuthGuard>

// Show user info
<UserAvatar />
<SignOutButton />

// Use the hook directly
const { user, loading } = useAuth();
```

---

## Running the workspace

```bash
# Install all dependencies (run from workspace root)
pnpm install

# Build the shared package (required after changes)
pnpm --filter @myorg/auth-google build

# Watch mode during development
pnpm --filter @myorg/auth-google dev

# Run a specific app
pnpm --filter demo-nextjs dev
pnpm --filter demo-react dev

# Run all apps in parallel
pnpm dev
```

---

## Firebase Console checklist (one-time per project)

- [ ] Create a Firebase project at console.firebase.google.com
- [ ] Register a web app (Project Settings → Your apps → `</>`)
- [ ] Enable Google sign-in (Authentication → Sign-in method → Google → Enable)
- [ ] Add your production domain to authorized domains (Authentication → Settings → Authorized domains)
- [ ] Copy config values into `.env.local`

---

## Key decisions made

| Decision | Reason |
|---|---|
| Firebase Auth over next-auth | Works across Next.js, Vite, React Native — not locked to one framework |
| pnpm workspaces monorepo | One install, shared node_modules, `workspace:*` links packages locally |
| tsup for building | Outputs both CJS + ESM, generates `.d.ts` types, zero config |
| Peer deps for React + Firebase | Avoids duplicate instances across apps |
