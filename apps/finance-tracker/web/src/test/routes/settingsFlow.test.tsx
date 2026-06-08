import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsPage } from "@/routes/SettingsPage";
import { ApiError } from "@/lib/api";

/**
 * Task 1.6 — flow tests for the Settings "Connect Trading 212" card against a
 * mocked BFF. Asserts:
 *   1. Disconnected → renders the API-key form + Connect; connecting POSTs the
 *      key and invalidates the broker-status / holdings / accounts caches.
 *   2. An invalid_api_key rejection surfaces a validation error toast.
 *   3. Connected → renders status + last-synced + Disconnect; status:error
 *      shows the amber reconnect banner.
 *
 * Every call funnels through `@/lib/api` so we mock that. `<Link>` is mocked to a
 * plain anchor (no router mounted) and `sonner` toasts are captured.
 */

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();

/**
 * Route GET responses by path so the broker-status query and the accounts query
 * can return different shapes. Tests can override either by re-implementing
 * `apiGet` or by setting these holders. Accounts default to empty so existing
 * broker-only tests render an empty Accounts section without extra setup.
 */
let brokerStatusResponse: unknown = { connected: false };
let accountsResponse: unknown[] = [];
function defaultGet(path: string) {
  if (path === "/api/accounts") return Promise.resolve(accountsResponse);
  return Promise.resolve(brokerStatusResponse);
}
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => apiGet(path),
      post: (path: string, body?: unknown) => apiPost(path, body),
      delete: (path: string) => apiDelete(path),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccess(msg),
    error: (msg: string) => toastError(msg),
  },
}));

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiDelete.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  brokerStatusResponse = { connected: false };
  accountsResponse = [];
  apiGet.mockImplementation(defaultGet);
});

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient, invalidateSpy };
}

describe("SettingsPage — Connect Trading 212", () => {
  it("disconnected: renders the two-key form and POSTs both keys", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({ ok: true });

    const { invalidateSpy } = renderSettings();

    const publicInput = await screen.findByLabelText(/public \(api\) key/i);
    const secretInput = screen.getByLabelText(/private \(secret\) key/i);
    expect(publicInput).toHaveAttribute("type", "password");
    expect(secretInput).toHaveAttribute("type", "password");
    // Glossary card is preserved.
    expect(
      screen.getByText(/understanding your metrics/i),
    ).toBeInTheDocument();

    // Connect stays disabled until BOTH fields are filled.
    expect(screen.getByRole("button", { name: /^Connect$/ })).toBeDisabled();
    await user.type(publicInput, "  my-pub  ");
    expect(screen.getByRole("button", { name: /^Connect$/ })).toBeDisabled();
    await user.type(secretInput, "  my-priv  ");

    await user.click(screen.getByRole("button", { name: /^Connect$/ }));

    await waitFor(() => {
      // Both keys are trimmed before sending.
      expect(apiPost).toHaveBeenCalledWith("/api/broker/trading212/connect", {
        apiKey: "my-pub",
        apiSecret: "my-priv",
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["broker-status"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["holdings"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["accounts"] });
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("disconnected: surfaces a validation error toast on invalid_api_key", async () => {
    const user = userEvent.setup();
    apiPost.mockRejectedValue(
      new ApiError(400, "invalid_api_key", { error: "invalid_api_key" }),
    );

    renderSettings();

    await user.type(
      await screen.findByLabelText(/public \(api\) key/i),
      "bad-pub",
    );
    await user.type(
      screen.getByLabelText(/private \(secret\) key/i),
      "bad-priv",
    );
    await user.click(screen.getByRole("button", { name: /^Connect$/ }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/rejected/i),
      );
    });
  });

  it("connected: shows status, last-synced and disconnect", async () => {
    const user = userEvent.setup();
    brokerStatusResponse = {
      connected: true,
      status: "connected",
      last_synced_at: "2026-06-07T10:00:00.000Z",
    };
    apiDelete.mockResolvedValue({ ok: true });

    const { invalidateSpy } = renderSettings();

    expect(await screen.findByText(/^Connected$/)).toBeInTheDocument();
    // Last-synced renders via lib/format (nl-NL): "07 jun. 2026".
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    // No connect form when connected.
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    // No error banner when status is healthy.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Disconnect$/ }));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/broker/trading212");
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["broker-status"],
      });
    });
  });

  it("connected: a failed Sync now surfaces an error toast", async () => {
    const user = userEvent.setup();
    brokerStatusResponse = {
      connected: true,
      status: "connected",
      last_synced_at: "2026-06-07T10:00:00.000Z",
    };
    apiPost.mockRejectedValue(new ApiError(500, "sync_failed", {}));

    renderSettings();

    await user.click(
      await screen.findByRole("button", { name: /^Sync now$/ }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/sync failed/i),
      );
    });
  });

  it("connected with status:error: shows the amber reconnect banner", async () => {
    brokerStatusResponse = {
      connected: true,
      status: "error",
      last_error: "ip_blocked",
    };

    renderSettings();

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(/sync is blocked/i);
    expect(banner.className).toContain("text-warning");
  });
});

describe("SettingsPage — Accounts (delete)", () => {
  it("lists accounts and deletes a manual account after confirming", async () => {
    const user = userEvent.setup();
    accountsResponse = [
      { id: "acc1", source: "manual", label: "My Cash" },
      { id: "acc2", source: "revolut", label: "Revolut Invest" },
    ];
    apiDelete.mockResolvedValue({ ok: true });

    const { invalidateSpy } = renderSettings();

    // Both accounts are listed with their source.
    expect(await screen.findByText("My Cash")).toBeInTheDocument();
    expect(screen.getByText("Revolut Invest")).toBeInTheDocument();

    // Clicking trash opens a confirm dialog — nothing deleted yet.
    await user.click(screen.getByRole("button", { name: /delete my cash/i }));
    expect(apiDelete).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/delete account\?/i);

    // Confirming deletes the manual account (no broker disconnect for manual).
    await user.click(
      within(dialog).getByRole("button", { name: /^Delete$/ }),
    );

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/accounts/acc1");
    });
    // Manual source: must NOT touch the broker.
    expect(apiDelete).not.toHaveBeenCalledWith("/api/broker/trading212");

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["accounts"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["holdings"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["transactions"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["prices"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profiles"] });
    });
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/deleted/i));
  });

  it("cancelling the confirm dialog does not delete", async () => {
    const user = userEvent.setup();
    accountsResponse = [{ id: "acc1", source: "manual", label: "My Cash" }];

    renderSettings();

    await user.click(
      await screen.findByRole("button", { name: /delete my cash/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

    expect(apiDelete).not.toHaveBeenCalled();
  });

  it("deleting a trading212 account also disconnects the broker (orphan guard)", async () => {
    const user = userEvent.setup();
    brokerStatusResponse = { connected: true, status: "connected" };
    accountsResponse = [{ id: "acc9", source: "trading212", label: "T212" }];
    apiDelete.mockResolvedValue({ ok: true });

    const { invalidateSpy } = renderSettings();

    await user.click(await screen.findByRole("button", { name: /delete t212/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/accounts/acc9");
    });
    // Orphan guard: the broker connection is torn down too.
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/broker/trading212");
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["broker-status"],
      });
    });
  });

  it("shows a muted note when there are no accounts", async () => {
    accountsResponse = [];
    renderSettings();
    expect(await screen.findByText(/no accounts yet/i)).toBeInTheDocument();
  });
});
