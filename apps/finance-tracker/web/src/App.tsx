import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { AuthGate } from "@/components/auth/AuthGate";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";
import { queryClient } from "@/lib/queryClient";
import { router } from "@/router";

/**
 * App composition (M10):
 *   ThemeProvider          design tokens / light-dark
 *   └─ QueryClientProvider TanStack Query (drives useMe + later tile data)
 *      └─ AuthGate          Firebase auth boundary (LoginPage when signed out)
 *         └─ RouterProvider TanStack Router (the routed app shell)
 *
 * Any `/dev/*` route is a dev-only visual-QA surface with no auth or BFF
 * dependency (the layout preview, and the analytics-tile gallery at
 * `/dev/tiles` which seeds its own fixture cache), so it renders the router
 * directly, bypassing the AuthGate — matches the M9 behaviour where the preview
 * was reachable without signing in.
 */
function App() {
  // /dev/* bypasses the AuthGate, so it is honoured ONLY in `vite dev`. In a
  // production build there are no /dev routes (see router.tsx) and auth is
  // always enforced.
  const isDevSurface =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/dev/");

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {isDevSurface ? (
          <RouterProvider router={router} />
        ) : (
          <AuthGate>
            <RouterProvider router={router} />
          </AuthGate>
        )}
        {/* Toast host (M9 Sonner) — drives import/mutation feedback. */}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
