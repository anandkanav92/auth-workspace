import { Link } from "@tanstack/react-router";

/**
 * Single-account dashboard placeholder (M10.4 route `/account/$id`). Full tiles
 * scoped to one account land in later milestones; for now it confirms the param
 * routing works and links through to the account's holdings list.
 */
export function AccountPage({ id }: { id: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight text-fg">
        Account {id}
      </h1>
      <p className="text-sm text-muted">
        Account-scoped dashboard — coming soon.
      </p>
      <Link
        to="/account/$id/holdings"
        params={{ id }}
        className="inline-block text-sm font-medium text-accent underline"
      >
        View holdings
      </Link>
    </div>
  );
}
