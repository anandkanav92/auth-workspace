import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { AuthGate } from "@/components/auth/AuthGate";
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
 * `/dev/layout` is a dev-only visual-QA surface with no auth or BFF dependency,
 * so it renders the router directly, bypassing the AuthGate (matches the M9
 * behaviour where the preview was reachable without signing in).
 */
function App() {
  const isDevLayout =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/dev/layout");

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {isDevLayout ? (
          <RouterProvider router={router} />
        ) : (
          <AuthGate>
            <RouterProvider router={router} />
          </AuthGate>
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
