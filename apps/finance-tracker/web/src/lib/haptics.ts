/**
 * M15.6 — haptic feedback on confirm actions.
 *
 * Fires a short vibration on devices that support the Vibration API (Android
 * Chrome). iOS Safari and desktop browsers don't implement it, so the optional
 * chaining makes this a no-op there rather than throwing. Call on user-initiated
 * confirm actions (add, sell, import) — not on passive UI changes.
 */
export function haptic(durationMs = 10): void {
  // `navigator.vibrate` is undefined on unsupported browsers; guard it.
  navigator.vibrate?.(durationMs);
}
