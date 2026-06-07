import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildSellUndoBody,
  useAdjustHolding,
  useFullSellHolding,
  useSellHolding,
  useUndoSell,
  type AdjustBody,
} from "@/lib/holdings";
import { formatEur, formatPct, formatQty } from "@/lib/format";
import type { Holding, Position } from "@/tiles/types";

/**
 * M14.3 / M14.4 — bottom sheet for a single position.
 *
 * Three modes inside one sheet:
 *   - `detail` : read-only summary + buttons (Edit, Sell, Sell all).
 *   - `edit`   : adjust quantity / total cost → PATCH /api/holdings/:id.
 *   - `sell`   : partial sell (qty + price + currency) → POST /api/holdings/:id/sell.
 * "Sell all" is the full-sell DELETE /api/holdings/:id with a sale price.
 *
 * The sheet renders off the joined {@link Position} (EUR values, name, P&L), but
 * the mutations need the RAW {@link Holding} (account, ticker, cost in
 * cost_currency) to build server-contract bodies and to compute an exact undo.
 * Both are passed in.
 *
 * UNDO: a partial sell fires a sonner toast with an Undo action that re-adds the
 * sold quantity + sold cost portion (an exact compensating POST /api/holdings).
 * Full sell shows a plain success toast (no undo) — re-opening a deliberately
 * closed position is a different intent than nudging a partial sale.
 */

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK"] as const;

type Mode = "detail" | "edit" | "sell";

export interface PositionSheetProps {
  position: Position | null;
  /** The raw holding backing `position` (server-contract source of truth). */
  holding: Holding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PositionSheet({
  position,
  holding,
  open,
  onOpenChange,
}: PositionSheetProps) {
  const [mode, setMode] = useState<Mode>("detail");

  // Reset to the detail view each time the sheet opens for a (new) position.
  useEffect(() => {
    if (open) setMode("detail");
  }, [open, position?.id]);

  if (!position || !holding) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="safe-bottom rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{position.ticker}</SheetTitle>
          <SheetDescription>{position.name}</SheetDescription>
        </SheetHeader>

        {mode === "detail" ? (
          <DetailView
            position={position}
            onEdit={() => setMode("edit")}
            onSell={() => setMode("sell")}
            holding={holding}
            onClose={() => onOpenChange(false)}
          />
        ) : mode === "sell" ? (
          <SellForm
            position={position}
            holding={holding}
            onDone={() => onOpenChange(false)}
            onCancel={() => setMode("detail")}
          />
        ) : (
          <EditForm
            holding={holding}
            onDone={() => onOpenChange(false)}
            onCancel={() => setMode("detail")}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// --- detail -----------------------------------------------------------------

function DetailView({
  position,
  holding,
  onEdit,
  onSell,
  onClose,
}: {
  position: Position;
  holding: Holding;
  onEdit: () => void;
  onSell: () => void;
  onClose: () => void;
}) {
  const fullSell = useFullSellHolding();
  const [confirmFull, setConfirmFull] = useState(false);
  const [fullPrice, setFullPrice] = useState("");
  const [fullCurrency, setFullCurrency] = useState(
    holding.cost_currency || "EUR",
  );
  const [error, setError] = useState<string | null>(null);

  function handleFullSell() {
    const price = fullPrice === "" ? Number.NaN : Number(fullPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a sale price");
      return;
    }
    setError(null);
    fullSell.mutate(
      { id: holding.id, body: { price, currency: fullCurrency } },
      {
        onSuccess: () => {
          toast.success(`Closed your ${position.ticker} position.`);
          onClose();
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Could not close the position.",
          ),
      },
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Detail label="Quantity" value={formatQty(position.quantity)} />
        <Detail label="Value" value={formatEur(position.valueEur)} />
        <Detail
          label="Cost"
          value={
            position.hasCost && position.costEur !== null
              ? formatEur(position.costEur)
              : "—"
          }
        />
        <Detail
          label="P&L"
          value={
            position.hasCost && position.returnEur !== null
              ? `${position.returnEur >= 0 ? "+" : ""}${formatEur(
                  position.returnEur,
                )}${
                  position.returnPct !== null
                    ? ` (${formatPct(position.returnPct)})`
                    : ""
                }`
              : "—"
          }
          tone={
            !position.hasCost
              ? undefined
              : (position.returnEur ?? 0) >= 0
                ? "success"
                : "danger"
          }
        />
      </dl>

      {!confirmFull ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          <Button type="button" onClick={onSell}>
            Sell
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmFull(true)}
          >
            Sell all
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-fg">
            Sell the entire position?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Sale price (per share)"
              htmlFor="full-price"
              error={error ?? undefined}
            >
              <input
                id="full-price"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={fullPrice}
                onChange={(e) => setFullPrice(e.target.value)}
                placeholder="0,00"
                className={fieldClass}
              />
            </Field>
            <Field label="Currency" htmlFor="full-currency">
              <select
                id="full-currency"
                value={fullCurrency}
                onChange={(e) => setFullCurrency(e.target.value)}
                className={fieldClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmFull(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleFullSell}
              disabled={fullSell.isPending}
            >
              {fullSell.isPending ? "Selling…" : "Confirm sell all"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={
          tone === "success"
            ? "tabular-nums text-success"
            : tone === "danger"
              ? "tabular-nums text-danger"
              : "tabular-nums text-fg"
        }
      >
        {value}
      </dd>
    </div>
  );
}

// --- partial sell -----------------------------------------------------------

function SellForm({
  position,
  holding,
  onDone,
  onCancel,
}: {
  position: Position;
  holding: Holding;
  onDone: () => void;
  onCancel: () => void;
}) {
  const sell = useSellHolding();
  const undoSell = useUndoSell();

  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(holding.cost_currency || "EUR");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const qty = quantity === "" ? Number.NaN : Number(quantity);
    const px = price === "" ? Number.NaN : Number(price);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a quantity to sell");
      return;
    }
    if (qty > holding.quantity) {
      setError(`You only hold ${formatQty(holding.quantity)}`);
      return;
    }
    if (!Number.isFinite(px) || px < 0) {
      setError("Enter a sale price");
      return;
    }
    setError(null);

    // Snapshot the pre-sell holding so undo can rebuild the exact prior totals.
    const before = holding;
    sell.mutate(
      { id: holding.id, body: { quantity: qty, price: px, currency } },
      {
        onSuccess: () => {
          toast.success(`Sold ${formatQty(qty)} ${position.ticker}.`, {
            action: {
              label: "Undo",
              onClick: () => undoSell.mutate(buildSellUndoBody(before, qty)),
            },
          });
          onDone();
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Could not sell the position.",
          ),
      },
    );
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
      <Field label="Quantity to sell" htmlFor="sell-qty" error={error ?? undefined}>
        <input
          id="sell-qty"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          max={holding.quantity}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={formatQty(holding.quantity)}
          className={fieldClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sale price (per share)" htmlFor="sell-price">
          <input
            id="sell-price"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0,00"
            className={fieldClass}
          />
        </Field>
        <Field label="Currency" htmlFor="sell-currency">
          <select
            id="sell-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={fieldClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" disabled={sell.isPending}>
          {sell.isPending ? "Selling…" : "Sell"}
        </Button>
      </div>
    </form>
  );
}

// --- edit qty / cost --------------------------------------------------------

function EditForm({
  holding,
  onDone,
  onCancel,
}: {
  holding: Holding;
  onDone: () => void;
  onCancel: () => void;
}) {
  const adjust = useAdjustHolding();

  const [quantity, setQuantity] = useState(String(holding.quantity));
  const [cost, setCost] = useState(
    holding.cost_basis != null ? String(holding.cost_basis) : "",
  );
  const [currency, setCurrency] = useState(holding.cost_currency || "EUR");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const body: AdjustBody = {};
    const qty = quantity === "" ? Number.NaN : Number(quantity);
    if (quantity !== "" && qty !== holding.quantity) {
      if (!Number.isFinite(qty) || qty <= 0) {
        setError("Quantity must be greater than zero");
        return;
      }
      body.quantity = qty;
    }

    const costNum = cost === "" ? null : Number(cost);
    const costChanged =
      (holding.cost_basis ?? null) !== (cost === "" ? null : Number(cost));
    if (costChanged) {
      if (costNum !== null && (!Number.isFinite(costNum) || costNum < 0)) {
        setError("Cost cannot be negative");
        return;
      }
      body.cost_basis = costNum;
      body.cost_currency = costNum === null ? null : currency;
    }

    if (Object.keys(body).length === 0) {
      setError("Change a value to save");
      return;
    }
    setError(null);

    adjust.mutate(
      { id: holding.id, body },
      {
        onSuccess: () => {
          toast.success(`Updated ${holding.ticker}.`);
          onDone();
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Could not update the position.",
          ),
      },
    );
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
      <Field label="Quantity" htmlFor="edit-qty" error={error ?? undefined}>
        <input
          id="edit-qty"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={fieldClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total cost" htmlFor="edit-cost">
          <input
            id="edit-cost"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="—"
            className={fieldClass}
          />
        </Field>
        <Field label="Currency" htmlFor="edit-currency">
          <select
            id="edit-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={fieldClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" disabled={adjust.isPending}>
          {adjust.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// --- shared form primitives -------------------------------------------------

const fieldClass =
  "h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
