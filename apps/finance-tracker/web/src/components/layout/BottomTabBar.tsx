import { Activity, PieChart, Search, Settings, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type BottomTabId = "portfolio" | "search" | "activity" | "settings";

interface TabDef {
  id: BottomTabId;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "portfolio", label: "Portfolio", Icon: PieChart },
  { id: "search", label: "Search", Icon: Search },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "settings", label: "Settings", Icon: Settings },
];

export interface BottomTabBarProps {
  activeId: BottomTabId;
  onSelect?: (id: BottomTabId) => void;
}

/**
 * Fixed bottom navigation for the four primary destinations. Uses the
 * `.safe-bottom` helper (env(safe-area-inset-bottom)) so the row clears the iOS
 * home indicator. Hidden affordance on desktop is out of scope here — this is
 * the mobile-first primary nav and stays pinned at all widths.
 */
export function BottomTabBar({ activeId, onSelect }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === activeId;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect?.(id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "text-accent" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
