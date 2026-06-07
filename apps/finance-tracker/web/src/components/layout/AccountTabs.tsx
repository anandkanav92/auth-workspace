import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AccountTab {
  /** Stable identifier; "all" is reserved for the aggregate tab. */
  id: string;
  /** Display label, e.g. "All", "DEGIRO". */
  label: string;
}

export interface AccountTabsProps {
  tabs: AccountTab[];
  /** Currently selected tab id. */
  activeId: string;
  onSelect?: (id: string) => void;
  /** Invoked when the "+" (add account) affordance is pressed. */
  onAddAccount?: () => void;
}

/**
 * Horizontally scrollable account selector: an "All" aggregate, one chip per
 * connected account, and a trailing "+" to link a new account. Mobile-first —
 * the row scrolls horizontally rather than wrapping so it stays one line.
 */
export function AccountTabs({
  tabs,
  activeId,
  onSelect,
  onAddAccount,
}: AccountTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Accounts"
      className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelect?.(tab.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-accent text-accent-fg"
                : "bg-surface text-muted hover:text-fg",
            )}
          >
            {tab.label}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAddAccount}
        aria-label="Add account"
        className="shrink-0 rounded-full border border-border p-1.5 text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
