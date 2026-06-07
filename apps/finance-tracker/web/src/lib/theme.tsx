import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** User-selectable theme preference. "system" follows the OS. */
export type Theme = "light" | "dark" | "system";

/** The concrete theme actually applied to the DOM (system is resolved away). */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";
const THEME_ORDER: Theme[] = ["light", "dark", "system"];

interface ThemeContextValue {
  /** The user's stored preference (may be "system"). */
  theme: Theme;
  /** The concrete light/dark currently on the DOM. */
  resolvedTheme: ResolvedTheme;
  /** Set an explicit preference; persists to localStorage. */
  setTheme: (theme: Theme) => void;
  /** Cycle light -> dark -> system -> light. */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Read the persisted preference, validating it against the known set. */
export function readStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

/** Resolve a preference into the concrete theme that should hit the DOM. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

/** Apply (or clear) the data-theme attribute on <html>. */
function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredTheme()),
  );

  // Apply the resolved theme to the DOM whenever it changes.
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Recompute the resolved theme whenever the preference changes.
  useEffect(() => {
    setResolvedTheme(resolveTheme(theme));
  }, [theme]);

  // When (and only when) the preference is "system", track OS changes live.
  // An explicit light/dark choice must never auto-flip mid-session.
  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(mql.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (private mode); preference is still
      // honoured for the current session via React state.
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore — see setTheme */
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, cycleTheme }),
    [theme, resolvedTheme, setTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return ctx;
}
