import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ThemeProvider,
  useTheme,
  readStoredTheme,
  resolveTheme,
} from "@/lib/theme";

/**
 * Build a controllable matchMedia mock. `matches` reflects whether the OS
 * prefers dark; the returned `setSystemDark` flips it and fires listeners so we
 * can assert the "system" preference tracks OS changes live.
 */
function mockMatchMedia(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return dark;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => mql),
  );
  return {
    setSystemDark(next: boolean) {
      dark = next;
      listeners.forEach((cb) => cb({ matches: dark } as MediaQueryListEvent));
    },
  };
}

/** Tiny probe component that surfaces the hook's state to the DOM. */
function Probe() {
  const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>set-dark</button>
      <button onClick={cycleTheme}>cycle</button>
    </div>
  );
}

function htmlTheme() {
  return document.documentElement.getAttribute("data-theme");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readStoredTheme", () => {
  it("returns the stored value when valid", () => {
    localStorage.setItem("theme", "dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("falls back to system for missing or garbage values", () => {
    expect(readStoredTheme()).toBe("system");
    localStorage.setItem("theme", "purple");
    expect(readStoredTheme()).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("returns explicit choices unchanged", () => {
    mockMatchMedia(true); // OS prefers dark, but explicit wins
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("resolves system via prefers-color-scheme", () => {
    mockMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
    mockMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });
});

describe("ThemeProvider", () => {
  it("falls back to system -> prefers-color-scheme dark on first load", () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(htmlTheme()).toBe("dark");
  });

  it("honours a persisted explicit preference over the OS setting", () => {
    mockMatchMedia(true); // OS dark
    localStorage.setItem("theme", "light"); // user chose light
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(htmlTheme()).toBe("light");
  });

  it("persists an explicit choice to localStorage and applies it", async () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByText("set-dark"));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(htmlTheme()).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("cycles light -> dark -> system -> light", async () => {
    mockMatchMedia(false);
    localStorage.setItem("theme", "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    const cycle = screen.getByText("cycle");
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    await userEvent.click(cycle);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    await userEvent.click(cycle);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    await userEvent.click(cycle);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("tracks live OS changes ONLY while preference is system", async () => {
    const media = mockMatchMedia(false); // OS light
    localStorage.setItem("theme", "system");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");

    // OS flips to dark while on "system" -> resolved follows.
    act(() => media.setSystemDark(true));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("never auto-flips when an explicit preference is set", async () => {
    const media = mockMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    // User explicitly picks dark.
    await userEvent.click(screen.getByText("set-dark"));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");

    // OS now flips to light — explicit "dark" must NOT change.
    act(() => media.setSystemDark(false));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(htmlTheme()).toBe("dark");
  });
});
