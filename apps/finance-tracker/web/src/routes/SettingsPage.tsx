import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight } from "lucide-react";

/**
 * Settings (M10.4 route `/settings`). Most settings (accounts, preferences, data
 * export) are still to come; for now it hosts the link into the metrics glossary.
 */
export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-fg">Settings</h1>

      <nav className="overflow-hidden rounded-xl bg-surface shadow-sm">
        <Link
          to="/learn"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"
          >
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-fg">
              Understanding your metrics
            </span>
            <span className="block text-xs text-muted">
              What total return, diversification, P/E and the rest mean.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </Link>
      </nav>

      <p className="px-1 text-sm text-muted">
        More settings (accounts, preferences, data export) coming soon.
      </p>
    </div>
  );
}
