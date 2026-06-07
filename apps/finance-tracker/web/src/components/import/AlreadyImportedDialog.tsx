import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface AlreadyImportedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ISO timestamp of the prior import (from the BFF 409 body). */
  importedAt: string | null;
  /** Filename the BFF recorded for the prior import, if available. */
  filename?: string | null;
  /** Dismiss + reset so the user can pick a different file/account. */
  onChooseAnother: () => void;
}

/**
 * M12.5 — the BFF returns 409 `{ error: 'already_imported', importedAt,
 * filename }` when the exact same file was already imported into this account
 * (dedup by sha256). We surface that clearly rather than as a generic error so
 * the user understands it's a no-op, not a failure.
 */
export function AlreadyImportedDialog({
  open,
  onOpenChange,
  importedAt,
  filename,
  onChooseAnother,
}: AlreadyImportedDialogProps) {
  const dateLabel = importedAt ? formatDate(new Date(importedAt)) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Already imported</DialogTitle>
          <DialogDescription>
            {dateLabel
              ? `This statement was already imported on ${dateLabel}.`
              : "This statement has already been imported."}
            {filename ? ` (${filename})` : ""} Re-importing the same file makes
            no changes.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={onChooseAnother}>Choose a different file</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
