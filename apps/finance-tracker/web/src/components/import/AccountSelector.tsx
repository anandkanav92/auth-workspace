import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import {
  IMPORT_SOURCES,
  useCreateAccount,
  type ImportSource,
} from "@/lib/accounts";
import type { Account } from "@/tiles/types";

interface AccountSelectorProps {
  accounts: Account[];
  /** Currently selected account id, or null when none is chosen. */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Friendly label for a broker source. */
function sourceLabel(source: Account["source"]): string {
  switch (source) {
    case "trading212":
      return "Trading 212";
    case "revolut":
      return "Revolut";
    default:
      return "Manual";
  }
}

/**
 * M12.1 — pick the account a statement imports into, with inline creation.
 *
 * The diff is computed against the chosen account's current holdings and a
 * commit snapshot-replaces them, so picking the right account is essential —
 * this is a deliberate, explicit choice rather than a guess from the file.
 */
export function AccountSelector({
  accounts,
  selectedId,
  onSelect,
}: AccountSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-fg">Import into account</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="text-accent"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-3 py-4 text-center text-sm text-muted">
          No accounts yet — create one to import into.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label="Import into account"
          className="grid gap-2"
        >
          {accounts.map((account) => {
            const isSelected = account.id === selectedId;
            return (
              <button
                key={account.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelect(account.id)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface hover:border-accent/50",
                )}
              >
                <span className="text-sm font-medium text-fg">
                  {account.label}
                </span>
                <span className="text-xs text-muted">
                  {sourceLabel(account.source)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <CreateAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(account) => {
          onSelect(account.id);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (account: Account) => void;
}

/** Inline "create account" form shown in a modal dialog. */
function CreateAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateAccountDialogProps) {
  const [source, setSource] = useState<ImportSource>(IMPORT_SOURCES[0].value);
  const [label, setLabel] = useState("");
  const createAccount = useCreateAccount();

  const trimmedLabel = label.trim();
  const canSubmit = trimmedLabel.length > 0 && !createAccount.isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    haptic(); // M15.6: confirm-action haptic.
    createAccount.mutate(
      { source, label: trimmedLabel },
      {
        // M15.4: toast on every mutation (account creation included).
        onSuccess: (account) => {
          setLabel("");
          toast.success(`Created “${account.label}”.`);
          onCreated(account);
        },
        onError: (error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not create the account.",
          ),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>
            Create the broker account you want to import this statement into.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-fg" htmlFor="account-source">
              Broker
            </label>
            <select
              id="account-source"
              value={source}
              onChange={(event) => setSource(event.target.value as ImportSource)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {IMPORT_SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-fg" htmlFor="account-label">
              Label
            </label>
            <input
              id="account-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. T212 Invest"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {createAccount.isError && (
            <p className="text-sm text-danger" role="alert">
              Could not create the account. Please try again.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createAccount.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createAccount.isPending ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
