import type { ReactNode } from "react";
import { useAuth } from "@myorg/auth-google";

import { LoginPage } from "@/components/auth/LoginPage";
import { Skeleton } from "@/components/ui/skeleton";

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
    // M15.1: a minimal branded skeleton instead of spinner/text while Firebase
    // resolves the persisted session (avoids a flash of the login screen).
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg"
      >
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
