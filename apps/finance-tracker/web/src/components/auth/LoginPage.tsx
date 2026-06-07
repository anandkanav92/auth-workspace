import { PieChart } from "lucide-react";
import { SignInButton } from "@myorg/auth-google";

/**
 * M10.3 — branded, mobile-first sign-in screen.
 *
 * Shown by <AuthGate /> whenever there is no authenticated user. It carries the
 * single "Sign in with Google" affordance (the package's <SignInButton />,
 * which owns the popup flow and its loading state). Styling uses the M9 semantic
 * tokens (`bg-bg`, `text-fg`, `bg-accent`, ...) so it tracks light/dark
 * automatically via the ThemeProvider that wraps it.
 */
export function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg">
          <PieChart className="h-8 w-8" aria-hidden />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Finance Tracker
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your investments, all in one place.
        </p>

        <SignInButton className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60" />

        <p className="mt-6 text-xs text-muted">
          We only use your Google account to sign you in.
        </p>
      </div>
    </main>
  );
}
