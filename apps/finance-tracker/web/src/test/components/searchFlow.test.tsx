import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchCommand } from "@/components/search/SearchCommand";

/**
 * M13 — flow test of the search palette + add-position sheet against a mocked
 * BFF. Asserts the three behaviours the plan calls out:
 *   1. Search is debounced (300ms) → exactly one GET /api/search after typing.
 *   2. Selecting a result opens the "Add to..." sheet.
 *   3. Submitting the form posts the correct /api/holdings body AND invalidates
 *      the ["holdings"] query so the dashboard tiles refetch.
 *
 * We mock `@/lib/api`'s verbs (every M13 call funnels through them) and `sonner`
 * (no real toast host mounted). cmdk needs `ResizeObserver` + `scrollIntoView`,
 * both stubbed in src/test/setup.ts.
 */

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => apiGet(path),
      post: (path: string, body?: unknown) => apiPost(path, body),
    },
  };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccess(msg),
    error: (msg: string) => toastError(msg),
  },
}));

const ACCOUNTS = [
  { id: "acc-1", source: "trading212" as const, label: "T212 Invest" },
  { id: "acc-2", source: "manual" as const, label: "My manual book" },
];

const AAPL = { ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" };

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  apiGet.mockImplementation((path: string) => {
    if (path === "/api/accounts") return Promise.resolve(ACCOUNTS);
    if (path.startsWith("/api/search")) return Promise.resolve([AAPL]);
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPalette() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SearchCommand open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
  return { ...utils, invalidateSpy };
}

describe("search palette", () => {
  it("debounces typing into a single /api/search call", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = screen.getByPlaceholderText(/search ticker/i);
    // Type four characters in quick succession. Without debouncing this would
    // fire up to four searches ("a", "aa", "aap", "aapl"); with the 300ms
    // debounce only the final value should be queried, exactly once.
    await user.type(input, "aapl");

    // Immediately after typing the debounce window hasn't elapsed: no request.
    expect(
      apiGet.mock.calls.filter((c) => String(c[0]).startsWith("/api/search")),
    ).toHaveLength(0);

    // After the debounce settles, exactly one search is issued for "aapl".
    await waitFor(() => {
      const calls = apiGet.mock.calls.filter((c) =>
        String(c[0]).startsWith("/api/search"),
      );
      expect(calls).toHaveLength(1);
    });
    const searchCalls = apiGet.mock.calls.filter((c) =>
      String(c[0]).startsWith("/api/search"),
    );
    expect(searchCalls[0][0]).toBe("/api/search?q=aapl");

    // Give any stray trailing debounce a chance to (wrongly) fire — it must not.
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(
      apiGet.mock.calls.filter((c) => String(c[0]).startsWith("/api/search")),
    ).toHaveLength(1);
  });

  it("opens the add sheet when a result is selected", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = await screen.findByPlaceholderText(/search ticker/i);
    await user.type(input, "aapl");

    const option = await screen.findByText("Apple Inc.");
    await user.click(option);

    // The add sheet titles with the selected ticker.
    expect(
      await screen.findByRole("heading", { name: /add aapl/i }),
    ).toBeInTheDocument();
    // Account dropdown lists the manual account too (manual-account case).
    expect(
      screen.getByRole("option", { name: /My manual book \(manual\)/ }),
    ).toBeInTheDocument();
  });

  it("submits the correct /api/holdings body and invalidates holdings", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({ id: "h-1" });

    const { invalidateSpy } = renderPalette();

    const input = await screen.findByPlaceholderText(/search ticker/i);
    await user.type(input, "aapl");
    await user.click(await screen.findByText("Apple Inc."));

    const dialog = await screen.findByRole("dialog", { name: /add aapl/i });

    // Default account is the first one (acc-1). Fill quantity + cost.
    await user.type(within(dialog).getByLabelText(/quantity/i), "10");
    await user.type(within(dialog).getByLabelText(/total cost/i), "1500");
    // Currency defaults to EUR; leave it.

    await user.click(
      within(dialog).getByRole("button", { name: /add position/i }),
    );

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/holdings", {
        account: "acc-1",
        ticker: "AAPL",
        quantity: 10,
        cost_basis: 1500,
        cost_currency: "EUR",
      });
    });

    // Dashboard refresh: the per-user holdings query is invalidated.
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["holdings"] });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Added AAPL to your portfolio.");
  });

  it("blocks submit and shows a validation error when quantity is missing", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = await screen.findByPlaceholderText(/search ticker/i);
    await user.type(input, "aapl");
    await user.click(await screen.findByText("Apple Inc."));

    const dialog = await screen.findByRole("dialog", { name: /add aapl/i });
    await user.click(
      within(dialog).getByRole("button", { name: /add position/i }),
    );

    // An empty quantity field is rejected (no POST), surfacing an inline error.
    expect(
      await within(dialog).findByText(/enter a quantity/i),
    ).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });
});
