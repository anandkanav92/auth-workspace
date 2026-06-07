import type { ReactNode } from "react";
import { useAuth } from "@myorg/auth-google";

import { LoginPage } from "@/components/auth/LoginPage";

/**
 * M10.2 — auth boundary for the app.
 *
 * Reads the Firebase auth state via the package's useAuth() ({ user, loading }):
 *  - while `loading`: render a minimal centered loading state (avoids a flash of
 *    the login screen for already-signed-in users on reload);
 *  - signed out: render <LoginPage />;
 *  - signed in: render children.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-bg text-muted"
      >
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
