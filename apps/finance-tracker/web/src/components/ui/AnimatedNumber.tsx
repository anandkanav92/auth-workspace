import { useEffect, useRef, useState } from "react";
import {
  animate,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "framer-motion";

/**
 * M15.2 — subtle count-up animation for headline value/price numbers.
 *
 * Tweens the *numeric* value between renders and formats each interpolated frame
 * with the caller's `format` fn, so it stays locale-correct (the dashboard uses
 * nl-NL EUR/percent formatting). Used by the hero total and tile headline numbers
 * so a price refresh animates from the old value to the new rather than snapping.
 *
 * Design intent (keep it subtle):
 *   - First mount does NOT animate from zero — it renders the real value
 *     immediately (avoids a distracting "spin-up" on every page load / skeleton
 *     hand-off). Only *changes* to an already-shown value animate.
 *   - Respects `prefers-reduced-motion`: when set, value changes apply instantly.
 *   - Short, eased tween (~0.6s) so it reads as a settle, not a slot machine.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  durationMs = 600,
}: {
  /** The target numeric value to display. */
  value: number;
  /** Formats an interpolated numeric frame to its display string. */
  format: (value: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  // Start already showing the real value (no spin-up from 0 on first paint).
  const [display, setDisplay] = useState(() => format(value));
  const prevValue = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the initial effect run — the first render already shows `value`.
    if (!mounted.current) {
      mounted.current = true;
      prevValue.current = value;
      return;
    }

    const from = prevValue.current;
    prevValue.current = value;

    // No change, or motion disabled → apply instantly.
    if (from === value || reduceMotion) {
      setDisplay(format(value));
      return;
    }

    const controls: AnimationPlaybackControls = animate(from, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(format(latest)),
    });
    return () => controls.stop();
  }, [value, format, reduceMotion, durationMs]);

  // aria-live so assistive tech announces the settled value, not every frame.
  return (
    <span className={className} aria-live="polite">
      {display}
    </span>
  );
}
