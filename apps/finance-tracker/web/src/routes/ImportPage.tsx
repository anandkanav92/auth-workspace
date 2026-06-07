import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AccountSelector } from "@/components/import/AccountSelector";
import { AlreadyImportedDialog } from "@/components/import/AlreadyImportedDialog";
import { Dropzone } from "@/components/import/Dropzone";
import { ImportPreview } from "@/components/import/ImportPreview";
import { UploadSkeleton } from "@/components/import/UploadSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/lib/accounts";
import { haptic } from "@/lib/haptics";
import {
  commitImport,
  isAlreadyImported,
  uploadStatement,
  type AlreadyImportedBody,
  type UploadPreview,
} from "@/lib/import";

/**
 * M12 — statement upload + import UX on `/import`.
 *
 * Flow (a small state machine):
 *   idle      → pick account + drop a PDF
 *   uploading → POST /api/import/upload (skeleton)
 *   preview   → review the diff, then Confirm
 *   committing→ POST /api/import/commit → toast → navigate to the dashboard
 *
 * The 409 "already imported" response is surfaced as a clear modal rather than
 * a generic error toast (see {@link AlreadyImportedDialog}).
 */
type Stage = "idle" | "uploading" | "preview" | "committing";

export function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accountsQuery = useAccounts();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [duplicate, setDuplicate] = useState<AlreadyImportedBody | null>(null);

  // Auto-select when there's exactly one account, so the upload zone is usable
  // immediately (e.g. right after creating your first account) instead of being
  // a silently-disabled dropzone with nothing to pick.
  useEffect(() => {
    const list = accountsQuery.data ?? [];
    if (!selectedAccountId && list.length === 1) {
      setSelectedAccountId(list[0].id);
    }
  }, [accountsQuery.data, selectedAccountId]);

  function reset() {
    setStage("idle");
    setPreview(null);
  }

  async function handleFile(file: File) {
    if (!selectedAccountId) {
      toast.error(
        (accountsQuery.data?.length ?? 0) === 0
          ? 'Create an account first — use "New account" above — then upload.'
          : "Select an account above first.",
      );
      return;
    }
    setStage("uploading");
    try {
      const result = await uploadStatement(file, selectedAccountId);
      setPreview(result);
      setStage("preview");
    } catch (error) {
      if (isAlreadyImported(error)) {
        setDuplicate(error.body);
        reset();
        return;
      }
      const message =
        error instanceof Error ? error.message : "Could not read the statement.";
      toast.error(message);
      reset();
    }
  }

  async function handleConfirm() {
    if (!preview || !selectedAccountId) return;
    haptic(); // M15.6: confirm-action haptic.
    setStage("committing");
    try {
      const result = await commitImport(preview.previewId);
      // The snapshot-replace changed this account's holdings; refresh the
      // dashboard data so it reflects the import immediately.
      void queryClient.invalidateQueries({ queryKey: ["holdings"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(
        `Imported ${result.rowCount} position${result.rowCount === 1 ? "" : "s"}.`,
      );
      navigate({ to: "/account/$id", params: { id: selectedAccountId } });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not import the statement.";
      // A 404 here means the preview expired (in-memory, 10-min TTL); prompt a
      // sensible re-upload by returning to the idle state.
      toast.error(message);
      reset();
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Import</h1>
        <p className="text-sm text-muted">
          Upload a Trading 212 or Revolut statement to sync your holdings.
        </p>
      </div>

      {stage === "preview" && preview ? (
        <ImportPreview
          preview={preview}
          committing={false}
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      ) : stage === "committing" && preview ? (
        <ImportPreview
          preview={preview}
          committing
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      ) : (
        <div className="space-y-5">
          {accountsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : accountsQuery.isError ? (
            <p className="text-sm text-danger" role="alert">
              Could not load your accounts. Please try again.
            </p>
          ) : (
            <AccountSelector
              accounts={accountsQuery.data ?? []}
              selectedId={selectedAccountId}
              onSelect={setSelectedAccountId}
            />
          )}

          {stage === "uploading" ? (
            <UploadSkeleton />
          ) : (
            // Always interactive: tapping opens the file picker, and handleFile
            // gives clear, contextual guidance if no account is chosen yet —
            // never a silent, do-nothing click.
            <Dropzone onFile={handleFile} />
          )}

          {!selectedAccountId && (
            <p className="text-xs text-muted">
              {(accountsQuery.data?.length ?? 0) === 0
                ? 'Create an account above (use "New account") to start importing.'
                : "Select an account above to enable the upload."}
            </p>
          )}
        </div>
      )}

      <AlreadyImportedDialog
        open={duplicate !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicate(null);
        }}
        importedAt={duplicate?.importedAt ?? null}
        filename={duplicate?.filename ?? null}
        onChooseAnother={() => setDuplicate(null)}
      />
    </div>
  );
}
