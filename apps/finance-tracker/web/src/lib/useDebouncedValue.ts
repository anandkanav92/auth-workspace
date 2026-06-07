import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` has
 * elapsed without a further change. Used by the ticker search (M13.2) so we hit
 * `GET /api/search` once the user pauses typing rather than on every keystroke.
 *
 * The timer is reset on every `value` change; the cleanup clears the pending
 * timeout so a rapid sequence of keystrokes collapses to a single trailing
 * update.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
