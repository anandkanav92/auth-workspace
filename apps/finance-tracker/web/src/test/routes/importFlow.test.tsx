import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ImportPage } from "@/routes/ImportPage";
import { ApiError } from "@/lib/api";

/**
 * M12.6 — flow smoke test of the import UX against a mocked BFF.
 *
 * Playwright is not configured in this package, so per the plan we drive the
 * full flow with Testing Library and the api client mocked, asserting:
 *   upload → preview render → confirm → /api/import/commit called.
 * Plus the 409 "already imported" branch surfaces the modal.
 *
 * We mock `@/lib/api`'s `api` verbs (every import-flow call funnels through
 * them) and the router's `useNavigate` so the success redirect is observable
 * without a real router.
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

const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccess(msg),
    error: (msg: string) => toastError(msg),
  },
}));

const ACCOUNT = { id: "acc-1", source: "trading212" as const, label: "T212 Invest" };

const PREVIEW = {
  previewId: "prev-123",
  diff: [
    {
      ticker: "AAPL",
      isin: "US0378331005",
      status: "new" as const,
      currentQuantity: 0,
      newQuantity: 10,
      costBasis: 1500,
      costCurrency: "EUR",
      isNewTicker: true,
    },
    {
      ticker: "MSFT",
      isin: "US5949181045",
      status: "changed" as const,
      currentQuantity: 5,
      newQuantity: 8,
      costBasis: 2000,
      costCurrency: "EUR",
      isNewTicker: false,
    },
    {
      ticker: "TSLA",
      isin: "US88160R1014",
      status: "removed" as const,
      currentQuantity: 3,
      newQuantity: 0,
      isNewTicker: false,
    },
  ],
  summary: {
    total: 3,
    new: 1,
    changed: 1,
    unchanged: 0,
    removed: 1,
    newTickers: 1,
  },
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportPage />
    </QueryClientProvider>,
  );
}

function makePdf(name = "statement.pdf") {
  return new File(["%PDF-1.4 fake"], name, { type: "application/pdf" });
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  navigateMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  apiGet.mockResolvedValue([ACCOUNT]);
});

describe("import flow", () => {
  it("upload → preview render → confirm → commit + navigate", async () => {
    const user = userEvent.setup();
    apiPost.mockImplementation((path: string) => {
      if (path === "/api/import/upload") return Promise.resolve(PREVIEW);
      if (path === "/api/import/commit")
        return Promise.resolve({ ok: true, importId: "imp-1", rowCount: 2 });
      throw new Error(`unexpected POST ${path}`);
    });

    renderPage();

    // Pick the account so the dropzone is enabled.
    await user.click(await screen.findByRole("radio", { name: /T212 Invest/ }));

    // Drop a PDF via the hidden file input react-dropzone renders.
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, makePdf());

    // Upload posted as multipart FormData.
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/import/upload",
        expect.any(FormData),
      );
    });

    // Preview renders the diff (each ticker + the replacing message). AAPL
    // appears in both the new-ticker callout and its diff row.
    expect(await screen.findAllByText("AAPL")).not.toHaveLength(0);
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("TSLA")).toBeInTheDocument();
    // "Replacing the 2 previous positions ..." (1 changed + 1 removed). The
    // count is interpolated across nodes, so match on full text content.
    expect(
      screen.getAllByText((_, el) =>
        Boolean(el?.textContent?.match(/replacing the 2 previous positions/i)),
      ).length,
    ).toBeGreaterThan(0);
    // New-ticker callout names AAPL.
    expect(screen.getByText(/1 new ticker/i)).toBeInTheDocument();

    // Confirm → commit with the previewId.
    const confirm = screen.getByRole("button", { name: /confirm 3 changes/i });
    await user.click(confirm);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/api/import/commit", {
        previewId: "prev-123",
      });
    });

    // Success toast + navigation to the account dashboard.
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Imported 2 positions.");
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/account/$id",
        params: { id: "acc-1" },
      });
    });
  });

  it("shows the already-imported modal on a 409 and does not commit", async () => {
    const user = userEvent.setup();
    apiPost.mockImplementation((path: string) => {
      if (path === "/api/import/upload") {
        return Promise.reject(
          new ApiError(409, "already_imported", {
            error: "already_imported",
            importedAt: "2026-05-01T10:00:00.000Z",
            filename: "old.pdf",
          }),
        );
      }
      throw new Error(`unexpected POST ${path}`);
    });

    renderPage();

    await user.click(await screen.findByRole("radio", { name: /T212 Invest/ }));
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, makePdf());

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /already imported/i }),
    ).toBeInTheDocument();
    // The prior import date (01 May 2026, nl-NL) and filename are shown.
    expect(within(dialog).getByText(/01 mei 2026/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/old\.pdf/)).toBeInTheDocument();
    // No commit attempted.
    expect(apiPost).not.toHaveBeenCalledWith(
      "/api/import/commit",
      expect.anything(),
    );
  });
});
