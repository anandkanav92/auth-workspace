import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HoldingsList } from "@/components/holdings/HoldingsList";

/**
 * M14 — flow tests for the holdings list + position sheet against a mocked BFF.
 * Asserts the behaviours the plan calls out:
 *   1. The list renders one row per OPEN position with the right value + P&L,
 *      and a null-cost (Revolut) position shows "—" for P&L.
 *   2. A partial sell POSTs the exact server body, optimistically decrements the
 *      cached holding, and invalidates ["holdings"].
 *   3. An edit PATCHes the adjustment body.
 *   4. "Show closed" toggles quantity-0 positions in/out of the list.
 *
 * Every M14 call funnels through `@/lib/api` (api.get/post/patch + apiFetch for
 * the DELETE full-sell), so we mock that module. `sonner` is mocked (no toast
 * host mounted) but we capture the toast action so the undo path is reachable.
 */

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiFetch = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    apiFetch: (path: string, opts?: unknown) => apiFetch(path, opts),
    api: {
      get: (path: string) => apiGet(path),
      post: (path: string, body?: unknown) => apiPost(path, body),
      patch: (path: string, body?: unknown) => apiPatch(path, body),
    },
  };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
let lastToastOptions: { action?: { label: string; onClick: () => void } } = {};
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string, opts?: typeof lastToastOptions) => {
      lastToastOptions = opts ?? {};
      return toastSuccess(msg, opts);
    },
    error: (msg: string) => toastError(msg),
  },
}));

const ACCOUNTS = [{ id: "acc-1", source: "manual" as const, label: "My book" }];

// Two cost-bearing T212 positions + one cost-null Revolut position. Prices in
// EUR so the joined value math is trivial. cost_currency "" marks "no cost".
const HOLDINGS = [
  {
    id: "h-aapl",
    account: "acc-1",
    ticker: "AAPL",
    quantity: 10,
    cost_basis: 1000,
    cost_currency: "EUR",
    source: "trading212",
  },
  {
    id: "h-msft",
    account: "acc-1",
    ticker: "MSFT",
    quantity: 5,
    cost_basis: 400,
    cost_currency: "EUR",
    source: "trading212",
  },
  {
    id: "h-tsla",
    account: "acc-1",
    ticker: "TSLA",
    quantity: 4,
    cost_basis: 0,
    cost_currency: "", // Revolut: no cost basis
    source: "revolut",
  },
];

const PRICES = [
  { ticker: "AAPL", price: 150, currency: "EUR" }, // value 1500, P&L +500
  { ticker: "MSFT", price: 100, currency: "EUR" }, // value 500, P&L +100
  { ticker: "TSLA", price: 200, currency: "EUR" }, // value 800, P&L unknown
];

const PROFILES = [
  { ticker: "AAPL", name: "Apple Inc.", asset_type: "stock" as const },
  { ticker: "MSFT", name: "Microsoft", asset_type: "stock" as const },
  { ticker: "TSLA", name: "Tesla", asset_type: "stock" as const },
];

const FX = { rates: {} };

function getImpl(path: string) {
  if (path === "/api/holdings") return Promise.resolve(HOLDINGS);
  if (path === "/api/accounts") return Promise.resolve(ACCOUNTS);
  if (path === "/api/prices") return Promise.resolve(PRICES);
  if (path === "/api/profiles") return Promise.resolve(PROFILES);
  if (path === "/api/fx") return Promise.resolve(FX);
  throw new Error(`unexpected GET ${path}`);
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPatch.mockReset();
  apiFetch.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  lastToastOptions = {};
  apiGet.mockImplementation(getImpl);
});

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <HoldingsList accountId="acc-1" />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient, invalidateSpy };
}

describe("HoldingsList", () => {
  it("renders one row per position with value + P&L, '—' for null-cost", async () => {
    renderList();

    // Apple: value 1500, gain +500.
    const apple = await screen.findByRole("button", { name: /AAPL Apple Inc\./ });
    expect(within(apple).getByText(/1\.500,00/)).toBeInTheDocument();
    expect(within(apple).getByText(/\+.*500,00/)).toBeInTheDocument();

    // Microsoft: value 500.
    const msft = await screen.findByRole("button", { name: /MSFT Microsoft/ });
    expect(within(msft).getByText(/500,00/)).toBeInTheDocument();

    // Tesla (Revolut, no cost): value 800, P&L renders as an em dash.
    const tsla = await screen.findByRole("button", { name: /TSLA Tesla/ });
    expect(within(tsla).getByText(/800,00/)).toBeInTheDocument();
    expect(within(tsla).getByText("—")).toBeInTheDocument();
  });

  it("partial sell posts the exact body, decrements optimistically, invalidates", async () => {
    const user = userEvent.setup();
    // Hold the POST pending so we can observe the OPTIMISTIC cache state before
    // the mutation settles (onSettled invalidates + refetches the fixture).
    let resolveSell: (value: unknown) => void = () => {};
    apiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveSell = resolve;
      }),
    );

    const { invalidateSpy, queryClient } = renderList();

    await user.click(
      await screen.findByRole("button", { name: /AAPL Apple Inc\./ }),
    );
    const dialog = await screen.findByRole("dialog", { name: "AAPL" });

    // Detail → Sell.
    await user.click(within(dialog).getByRole("button", { name: /^Sell$/ }));

    await user.type(within(dialog).getByLabelText(/quantity to sell/i), "4");
    await user.type(within(dialog).getByLabelText(/sale price/i), "150");
    await user.click(within(dialog).getByRole("button", { name: /^Sell$/ }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/holdings/h-aapl/sell", {
        quantity: 4,
        price: 150,
        currency: "EUR",
      });
    });

    // Optimistic cache update (while the POST is still pending): the cached AAPL
    // holding dropped to qty 6 with cost basis scaled to 600.
    await waitFor(() => {
      const cached = queryClient.getQueryData<typeof HOLDINGS>(["holdings"]);
      const aapl = cached?.find((h) => h.id === "h-aapl");
      expect(aapl?.quantity).toBe(6);
      expect(aapl?.cost_basis).toBeCloseTo(600);
    });

    // Now let it settle → invalidation fires.
    resolveSell({ id: "h-aapl", quantity: 6, cost_basis: 600 });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["holdings"] });
    });
  });

  it("undo after a partial sell re-adds the sold quantity + cost portion", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({ id: "h-aapl" });

    renderList();
    await user.click(
      await screen.findByRole("button", { name: /AAPL Apple Inc\./ }),
    );
    const dialog = await screen.findByRole("dialog", { name: "AAPL" });
    await user.click(within(dialog).getByRole("button", { name: /^Sell$/ }));
    await user.type(within(dialog).getByLabelText(/quantity to sell/i), "4");
    await user.type(within(dialog).getByLabelText(/sale price/i), "150");
    await user.click(within(dialog).getByRole("button", { name: /^Sell$/ }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(lastToastOptions.action?.label).toBe("Undo");

    apiPost.mockClear();
    lastToastOptions.action?.onClick();

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/holdings", {
        account: "acc-1",
        ticker: "AAPL",
        quantity: 4,
        cost_basis: 400, // 1000 * 4/10
        cost_currency: "EUR",
      });
    });
  });

  it("edit posts a PATCH adjustment body", async () => {
    const user = userEvent.setup();
    apiPatch.mockResolvedValue({ id: "h-aapl" });

    renderList();
    await user.click(
      await screen.findByRole("button", { name: /AAPL Apple Inc\./ }),
    );
    const dialog = await screen.findByRole("dialog", { name: "AAPL" });
    await user.click(within(dialog).getByRole("button", { name: /^Edit$/ }));

    const qty = within(dialog).getByLabelText(/^Quantity$/);
    await user.clear(qty);
    await user.type(qty, "12");
    await user.click(
      within(dialog).getByRole("button", { name: /save changes/i }),
    );

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith("/api/holdings/h-aapl", {
        quantity: 12,
      });
    });
  });

  it("'Show closed' toggles a quantity-0 position in and out", async () => {
    const user = userEvent.setup();
    // One closed position alongside the open ones (server normally filters these
    // out; here we exercise the UI toggle directly).
    const withClosed = [
      ...HOLDINGS,
      {
        id: "h-nflx",
        account: "acc-1",
        ticker: "NFLX",
        quantity: 0,
        cost_basis: 0,
        cost_currency: "EUR",
        source: "trading212" as const,
      },
    ];
    apiGet.mockImplementation((path: string) => {
      if (path === "/api/holdings") return Promise.resolve(withClosed);
      if (path === "/api/profiles")
        return Promise.resolve([
          ...PROFILES,
          { ticker: "NFLX", name: "Netflix", asset_type: "stock" as const },
        ]);
      return getImpl(path);
    });

    renderList();

    // Closed position hidden by default.
    await screen.findByRole("button", { name: /AAPL Apple Inc\./ });
    expect(
      screen.queryByRole("button", { name: /NFLX Netflix/ }),
    ).not.toBeInTheDocument();

    // Toggle on → it appears.
    await user.click(screen.getByLabelText(/show closed/i));
    expect(
      await screen.findByRole("button", { name: /NFLX Netflix/ }),
    ).toBeInTheDocument();

    // Toggle off → hidden again.
    await user.click(screen.getByLabelText(/show closed/i));
    expect(
      screen.queryByRole("button", { name: /NFLX Netflix/ }),
    ).not.toBeInTheDocument();
  });

  it("full sell calls DELETE with the sale price/currency body", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue({ id: "h-aapl", quantity: 0 });

    const { invalidateSpy } = renderList();
    await user.click(
      await screen.findByRole("button", { name: /AAPL Apple Inc\./ }),
    );
    const dialog = await screen.findByRole("dialog", { name: "AAPL" });

    await user.click(within(dialog).getByRole("button", { name: /sell all/i }));
    await user.type(within(dialog).getByLabelText(/sale price/i), "150");
    await user.click(
      within(dialog).getByRole("button", { name: /confirm sell all/i }),
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/holdings/h-aapl", {
        method: "DELETE",
        body: { price: 150, currency: "EUR" },
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["holdings"] });
    });
  });
});
