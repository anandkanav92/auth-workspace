import { ThemeProvider } from "@/lib/theme";
import { LayoutPreview } from "@/dev/LayoutPreview";

/**
 * Lightweight path switch. No router is wired up yet (milestone 9 is the shell
 * only), so we read the pathname directly. `/dev/layout` is a temporary
 * dev-only visual-QA surface for the layout components and will be removed once
 * a real router and pages land.
 */
function App() {
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <ThemeProvider>
      {path === "/dev/layout" ? (
        <LayoutPreview />
      ) : (
        <main className="min-h-screen bg-bg p-6 text-fg">
          <h1 className="text-2xl font-semibold">Finance Tracker</h1>
          <p className="mt-2 text-muted">Investment dashboard — coming soon.</p>
          <p className="mt-4 text-sm text-muted">
            Dev preview:{" "}
            <a className="text-accent underline" href="/dev/layout">
              /dev/layout
            </a>
          </p>
        </main>
      )}
    </ThemeProvider>
  );
}

export default App;
