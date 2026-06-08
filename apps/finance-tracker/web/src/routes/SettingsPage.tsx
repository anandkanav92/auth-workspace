import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BookOpen, ChevronRight, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  useBrokerStatus,
  useConnectBroker,
  useDisconnectBroker,
  useSyncNow,
} from "@/lib/broker";
import { formatDate } from "@/lib/format";

/**
 * Settings (M10.4 route `/settings`). Hosts the metrics glossary link and the
 * Trading 212 connection card (Task 1.6). Most other settings (preferences,
 * data export) are still to come.
 */
export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-fg">Settings</h1>

      <ConnectTrading212Card />

      <nav className="overflow-hidden rounded-xl bg-surface shadow-sm">
        <Link
          to="/learn"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"
          >
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-fg">
              Understanding your metrics
            </span>
            <span className="block text-xs text-muted">
              What total return, diversification, P/E and the rest mean.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </Link>
      </nav>

      <p className="px-1 text-sm text-muted">
        More settings (preferences, data export) coming soon.
      </p>
    </div>
  );
}

/** The Trading 212 connection card: disconnected form ↔ connected status. */
function ConnectTrading212Card() {
  const status = useBrokerStatus();

  return (
    <section className="space-y-3 rounded-xl bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"
        >
          <Link2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-fg">Connect Trading 212</h2>
          <p className="text-xs text-muted">
            Sync your holdings and history automatically.
          </p>
        </div>
      </div>

      {status.isPending ? (
        <CardLoading />
      ) : status.data?.connected ? (
        <ConnectedState
          syncStatus={status.data.status}
          lastSyncedAt={status.data.last_synced_at}
        />
      ) : (
        <DisconnectedState />
      )}
    </section>
  );
}

function CardLoading() {
  return (
    <div className="space-y-2" aria-label="Loading connection status">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

function DisconnectedState() {
  // T212 uses HTTP Basic auth with TWO keys (public + private); the server
  // combines them as "<public>:<private>". Both are required.
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const connect = useConnectBroker();

  const canConnect = apiKey.trim() !== "" && apiSecret.trim() !== "";

  function handleConnect() {
    const trimmedKey = apiKey.trim();
    const trimmedSecret = apiSecret.trim();
    if (!trimmedKey || !trimmedSecret) return;
    connect.mutate(
      { apiKey: trimmedKey, apiSecret: trimmedSecret },
      {
        onSuccess: () => {
          setApiKey("");
          setApiSecret("");
          toast.success("Trading 212 connected.");
        },
        onError: (err) => {
          const code =
            err instanceof ApiError && isInvalidKey(err)
              ? "Those API keys were rejected — check they're a valid read-only pair."
              : "Couldn't connect to Trading 212. Please try again.";
          toast.error(code);
        },
      },
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label
          htmlFor="t212-api-key"
          className="block text-xs font-medium text-fg"
        >
          Public (API) key
        </label>
        <input
          id="t212-api-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste your public read-only key"
          className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="t212-api-secret"
          className="block text-xs font-medium text-fg"
        >
          Private (secret) key
        </label>
        <input
          id="t212-api-secret"
          type="password"
          autoComplete="off"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="Paste your private secret key"
          className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <p className="text-xs text-muted">
        Use a <strong className="font-medium text-fg">read-only</strong> key
        (account/portfolio/history scopes; no order placement). Restrict it to IP{" "}
        <code className="rounded bg-muted/10 px-1 py-0.5 font-mono text-[11px] text-fg">
          77.173.30.177
        </code>
        .{" "}
        <Link to="/learn" className="text-accent underline-offset-2 hover:underline">
          What's this?
        </Link>
      </p>

      <Button
        type="button"
        size="sm"
        onClick={handleConnect}
        disabled={!canConnect || connect.isPending}
      >
        {connect.isPending ? "Connecting…" : "Connect"}
      </Button>
    </div>
  );
}

function ConnectedState({
  syncStatus,
  lastSyncedAt,
}: {
  syncStatus?: "connected" | "error";
  lastSyncedAt?: string;
}) {
  const disconnect = useDisconnectBroker();
  const syncNow = useSyncNow();

  function handleDisconnect() {
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success("Trading 212 disconnected."),
      onError: () => toast.error("Couldn't disconnect. Please try again."),
    });
  }

  function handleSyncNow() {
    syncNow.mutate(undefined, {
      onSuccess: () => toast.success("Trading 212 synced."),
      onError: () =>
        toast.error("Sync failed — check your connection and try again."),
    });
  }

  return (
    <div className="space-y-3">
      {syncStatus === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Trading 212 sync is blocked — your key or its IP allowlist may need
            updating. Reconnect with a fresh read-only key.
          </span>
        </div>
      )}

      <dl className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">Status</dt>
          <dd className="font-medium text-fg">
            {syncStatus === "error" ? "Needs attention" : "Connected"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Last synced</dt>
          <dd className="font-medium text-fg">
            {lastSyncedAt ? formatDate(new Date(lastSyncedAt)) : "Never"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSyncNow}
          disabled={syncNow.isPending}
        >
          {syncNow.isPending ? "Syncing…" : "Sync now"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleDisconnect}
          disabled={disconnect.isPending}
        >
          {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
        </Button>
      </div>
    </div>
  );
}

/** A connect failure carrying the server's `invalid_api_key` error code. */
function isInvalidKey(err: ApiError): boolean {
  return (
    typeof err.body === "object" &&
    err.body !== null &&
    (err.body as { error?: unknown }).error === "invalid_api_key"
  );
}
