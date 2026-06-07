import { useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { AddPositionSheet } from "@/components/search/AddPositionSheet";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTickerSearch, type SearchResult } from "@/lib/search";

/**
 * M13.1 / M13.2 — the ticker search palette.
 *
 * Wraps the shadcn `<Command />` (which wraps `cmdk`). The input is debounced
 * 300ms (see {@link useDebouncedValue}) before {@link useTickerSearch} hits
 * `GET /api/search`. `shouldFilter={false}` on the Command: the SERVER already
 * ranks/filters by the query, so we must NOT let cmdk re-filter the results by
 * the raw input string (which would hide e.g. "Apple Inc." when the user typed
 * "AAPL").
 *
 * Selecting a result opens the {@link AddPositionSheet}. The palette closes when
 * a result is picked so the sheet has the screen to itself.
 *
 * Two presentations share this body via the `as` prop:
 *   - "dialog"  → Cmd-K centred modal (desktop), rendered in {@link CommandDialog}
 *   - "overlay" → full-screen surface (mobile), rendered inline by the caller
 */

interface SearchPaletteBodyProps {
  onSelect: (result: SearchResult) => void;
  autoFocus?: boolean;
}

/** The shared input + results list. Reused by both presentations. */
function SearchPaletteBody({ onSelect, autoFocus }: SearchPaletteBodyProps) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const { data, isFetching } = useTickerSearch(debounced);

  const results = data ?? [];
  const trimmed = debounced.trim();
  const hasQuery = trimmed.length >= 2;

  return (
    <>
      <CommandInput
        placeholder="Search ticker or company…"
        value={query}
        onValueChange={setQuery}
        autoFocus={autoFocus}
      />
      <CommandList>
        {!hasQuery ? (
          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
        ) : isFetching && results.length === 0 ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No matches for “{trimmed}”.</CommandEmpty>
        ) : (
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={`${result.ticker}-${result.exchange}`}
                // value must be unique + stable; cmdk uses it as the item key
                // for keyboard selection. Filtering is off, so the value isn't
                // matched against the query.
                value={`${result.ticker} ${result.name}`}
                onSelect={() => onSelect(result)}
              >
                <span className="font-medium text-fg">{result.ticker}</span>
                <span className="truncate text-muted">{result.name}</span>
                {result.exchange ? (
                  <span className="ml-auto shrink-0 text-xs text-muted">
                    {result.exchange}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  );
}

export interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cmd-K command-palette presentation (desktop). Mount once near the app root;
 * the global keyboard shortcut toggles `open`.
 */
export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleSelect(result: SearchResult) {
    setSelected(result);
    setSheetOpen(true);
    onOpenChange(false); // close the palette; the sheet takes over
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
        <SearchPaletteBody onSelect={handleSelect} autoFocus />
      </CommandDialog>

      <AddPositionSheet
        result={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

/**
 * Full-screen overlay presentation (M13.5, mobile). Reachable from the bottom
 * tab bar's "Search" tab. Same body + add-sheet behaviour as {@link SearchCommand};
 * only the chrome differs — it fills the viewport rather than floating as a modal.
 */
export function SearchOverlay({ open, onOpenChange }: SearchCommandProps) {
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleSelect(result: SearchResult) {
    setSelected(result);
    setSheetOpen(true);
    onOpenChange(false);
  }

  if (!open) {
    // Still render the sheet so an in-flight add survives the overlay closing.
    return (
      <AddPositionSheet
        result={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Search"
      className="fixed inset-0 z-50 flex flex-col bg-bg"
    >
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Command
          shouldFilter={false}
          className="flex-1"
          // The overlay supplies its own header row; the body still owns the
          // input + list.
        >
          <SearchPaletteBody onSelect={handleSelect} autoFocus />
        </Command>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>

      <AddPositionSheet
        result={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
