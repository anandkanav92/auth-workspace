import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * M15.3 — shared empty state.
 *
 * One clear primary CTA, an optional secondary, a short explanation, and a
 * simple glyph (no heavy illustration — placeholder for a designer). Themed via
 * the M9 semantic tokens so it reads in light + dark.
 *
 * An action is EITHER a router link (`to` / `params`) or an `onClick` handler.
 * Links render as a styled <Link>; handlers render as a <Button>.
 */
export interface EmptyStateAction {
  label: string;
  /** Router destination — renders the action as a navigating link. */
  to?: string;
  /** Route params for `to`. */
  params?: Record<string, string>;
  /** Click handler — renders the action as a button (ignored if `to` is set). */
  onClick?: () => void;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional custom glyph; defaults to an inbox icon. */
  icon?: ReactNode;
  primaryAction: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: "default" | "outline";
}) {
  if (action.to) {
    return (
      <Button asChild variant={variant}>
        <Link to={action.to} params={action.params}>
          {action.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent"
      >
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <ActionButton action={primaryAction} variant="default" />
        {secondaryAction ? (
          <ActionButton action={secondaryAction} variant="outline" />
        ) : null}
      </div>
    </div>
  );
}
