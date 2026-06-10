import { FileUp, Plus, PlusCircle } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface FabMenuProps {
  /** Triggered when "Upload statement" is chosen. */
  onUpload?: () => void;
  /** Triggered when "Add a holding" is chosen (opens search to pick a ticker). */
  onAdd?: () => void;
}

/**
 * Floating action button anchored above the bottom tab bar. Tapping it opens a
 * bottom sheet offering the two ways to get data in: upload a broker statement,
 * or add a transaction by hand. Sheet (rather than a dropdown) because the
 * actions are primary and benefit from large touch targets on mobile.
 */
export function FabMenu({ onUpload, onAdd }: FabMenuProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Add data"
          className="safe-bottom fixed bottom-16 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="h-6 w-6" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="safe-bottom rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Add data</SheetTitle>
          <SheetDescription>
            Bring in holdings by uploading a statement or entering a transaction.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-2">
          <SheetClose asChild>
            <button
              type="button"
              onClick={onUpload}
              className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileUp className="h-5 w-5 text-accent" aria-hidden />
              <span>
                <span className="block font-medium text-fg">Upload statement</span>
                <span className="block text-sm text-muted">
                  Import a CSV or PDF from your broker.
                </span>
              </span>
            </button>
          </SheetClose>

          <SheetClose asChild>
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PlusCircle className="h-5 w-5 text-accent" aria-hidden />
              <span>
                <span className="block font-medium text-fg">Add a holding</span>
                <span className="block text-sm text-muted">
                  Search for a stock or ETF to add by hand.
                </span>
              </span>
            </button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
