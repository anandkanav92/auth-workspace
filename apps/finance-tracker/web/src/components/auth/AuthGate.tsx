import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@myorg/auth-google";

import { LoginPage } from "@/components/auth/LoginPage";
import { Skeleton } from "@/components/ui/skeleton";
import { clearSensitiveCaches } from "@/lib/clearCaches";

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

  // P0 privacy: when a signed-in session ends (user → null), wipe the cached
  // portfolio data so it can't survive logout on a shared device. We track the
  // prior authed state so this fires only on the sign-out TRANSITION, not on a
  // fresh never-signed-in load.
  const wasAuthed = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (user) {
      wasAuthed.current = true;
    } else if (wasAuthed.current) {
      wasAuthed.current = false;
      void clearSensitiveCaches();
    }
  }, [user, loading]);

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
