import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

interface DropzoneProps {
  /** Called with the chosen PDF. Single file only. */
  onFile: (file: File) => void;
  /** Disable interaction (e.g. while no account is selected, or uploading). */
  disabled?: boolean;
}

/**
 * M12.1 — drag-and-drop upload zone. Accepts a single PDF only; rejecting
 * everything else keeps the BFF's importer-detection from ever seeing garbage.
 * Mobile-first: the whole zone is tappable (it opens the native file picker)
 * since drag-and-drop is desktop-only.
 */
export function Dropzone({ onFile, disabled = false }: DropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: { "application/pdf": [".pdf"] },
      maxFiles: 1,
      multiple: false,
      disabled,
    });

  return (
    <div
      {...getRootProps()}
      aria-label="Upload statement"
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragReject
          ? "border-danger/60 bg-danger/5"
          : isDragActive
            ? "border-accent bg-accent/5"
            : "border-border bg-surface hover:border-accent/50",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input {...getInputProps()} />
      <div className="rounded-full bg-accent/10 p-3 text-accent">
        {isDragActive ? (
          <FileText className="h-6 w-6" aria-hidden />
        ) : (
          <UploadCloud className="h-6 w-6" aria-hidden />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-fg">
          {isDragReject
            ? "Only PDF statements are supported"
            : isDragActive
              ? "Drop the PDF to upload"
              : "Drag a statement here, or tap to browse"}
        </p>
        <p className="text-xs text-muted">
          Trading 212 or Revolut PDF export, up to 15 MB
        </p>
      </div>
    </div>
  );
}
