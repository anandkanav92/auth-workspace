import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { EmptyState } from "@/components/ui/EmptyState";
import { HoldingsList } from "@/components/holdings/HoldingsList";

/**
 * M15.3 — empty states render a single clear CTA.
 * M15.1 — the loading state renders a skeleton (not the empty CTA, not data).
 *
 * EmptyState renders a router <Link> for `to` actions, so we mock the router's
 * Link to a plain anchor (these tests don't need real navigation). HoldingsList
 * reads its data through `usePortfolioData` + `@/lib/api`, both mocked.
 */

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to?: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

// HoldingsList reads the joined portfolio + the raw holdings cache.
const apiGet = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: (path: string) => apiGet(path) },
  };
});

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  apiGet.mockReset();
});

describe("EmptyState", () => {
  it("renders the title, description, and a single primary CTA", () => {
    renderWithQuery(
      <EmptyState
        title="No accounts yet"
        description="Add your first account."
        primaryAction={{ label: "Add your first account", to: "/import" }}
        secondaryAction={{ label: "Upload a statement", to: "/import" }}
      />,
    );

    expect(screen.getByText("No accounts yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first account.")).toBeInTheDocument();

    const primary = screen.getByRole("link", {
      name: "Add your first account",
    });
    expect(primary).toHaveAttribute("href", "/import");
    expect(
      screen.getByRole("link", { name: "Upload a statement" }),
    ).toBeInTheDocument();
  });

  it("renders an onClick action as a button when no `to` is given", () => {
    const onClick = vi.fn();
    renderWithQuery(
      <EmptyState
        title="No results"
        primaryAction={{ label: "Clear search", onClick }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Clear search" }),
    ).toBeInTheDocument();
  });
});

describe("HoldingsList loading + empty states", () => {
  it("shows a skeleton while holdings are loading", () => {
    // Never resolve so the query stays in its loading state.
    apiGet.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithQuery(<HoldingsList accountId="acc-1" />);

    // The loading branch marks its region aria-busy and renders skeletons.
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    // No empty-state CTA while loading.
    expect(
      screen.queryByRole("link", { name: /add a position/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Add a position / Import CTA when the account has no holdings", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path === "/api/holdings") return Promise.resolve([]);
      if (path === "/api/accounts")
        return Promise.resolve([
          { id: "acc-1", source: "manual", label: "My book" },
        ]);
      if (path === "/api/prices") return Promise.resolve([]);
      if (path === "/api/profiles") return Promise.resolve([]);
      if (path === "/api/fx") return Promise.resolve(null);
      throw new Error(`unexpected GET ${path}`);
    });

    renderWithQuery(<HoldingsList accountId="acc-1" />);

    expect(await screen.findByText(/no holdings yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add a position/i }),
    ).toHaveAttribute("href", "/import");
    expect(screen.getByRole("link", { name: /^import$/i })).toBeInTheDocument();
  });
});
