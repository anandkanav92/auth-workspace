/**
 * Flat holdings list placeholder (M10.4 route `/account/$id/holdings`). The
 * virtualised list + position sheet + sell flow land in M14.
 */
export function AccountHoldingsPage({ id }: { id: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight text-fg">
        Holdings · {id}
      </h1>
      <p className="text-sm text-muted">Holdings list — coming soon.</p>
    </div>
  );
}
