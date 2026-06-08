import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
  it("disconnected: renders the connect form and POSTs the key", async () => {
    const user = userEvent.setup();
    apiGet.mockResolvedValue({ connected: false });
    apiPost.mockResolvedValue({ ok: true });

    const { invalidateSpy } = renderSettings();

    const input = await screen.findByLabelText(/api key/i);
    expect(input).toHaveAttribute("type", "password");
    // Glossary card is preserved.
    expect(
      screen.getByText(/understanding your metrics/i),
    ).toBeInTheDocument();

    await user.type(input, "  my-key  ");
    await user.click(screen.getByRole("button", { name: /^Connect$/ }));

    await waitFor(() => {
      // Key is trimmed before sending.
      expect(apiPost).toHaveBeenCalledWith("/api/broker/trading212/connect", {
        apiKey: "my-key",
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
    apiGet.mockResolvedValue({ connected: false });
    apiPost.mockRejectedValue(
      new ApiError(400, "invalid_api_key", { error: "invalid_api_key" }),
    );

    renderSettings();

    await user.type(await screen.findByLabelText(/api key/i), "bad-key");
    await user.click(screen.getByRole("button", { name: /^Connect$/ }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/rejected/i),
      );
    });
  });

  it("connected: shows status, last-synced and disconnect", async () => {
    const user = userEvent.setup();
    apiGet.mockResolvedValue({
      connected: true,
      status: "connected",
      last_synced_at: "2026-06-07T10:00:00.000Z",
    });
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

  it("connected with status:error: shows the amber reconnect banner", async () => {
    apiGet.mockResolvedValue({
      connected: true,
      status: "error",
      last_error: "ip_blocked",
    });

    renderSettings();

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(/sync is blocked/i);
    expect(banner.className).toContain("text-warning");
  });
});
