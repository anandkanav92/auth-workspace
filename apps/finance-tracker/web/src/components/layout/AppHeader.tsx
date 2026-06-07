import { SignOutButton } from "@myorg/auth-google";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useMe } from "@/lib/useMe";

/**
 * App header: title, theme toggle, and the signed-in identity with a sign-out
 * affordance. The identity (avatar initial + email) is driven by useMe()
 * (M10.6) — the BFF round-trip, not the raw Firebase user — so it reflects what
 * the backend knows about the account.
 */
export function AppHeader() {
  const { data: me, isLoading } = useMe();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
      <span className="text-base font-semibold tracking-tight text-fg">
        Finance Tracker
      </span>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        {me ? (
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg"
            >
              {me.email.charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[12rem] truncate text-sm text-muted sm:inline">
              {me.email}
            </span>
            <SignOutButton className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        ) : (
          <span className="text-sm text-muted">
            {isLoading ? "…" : null}
          </span>
        )}
      </div>
    </header>
  );
}
