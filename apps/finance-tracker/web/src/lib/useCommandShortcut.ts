import { useEffect } from "react";

/**
 * M13.1 — global Cmd-K / Ctrl-K shortcut to toggle the search palette.
 *
 * Binds a `keydown` listener for the whole document. Cmd-K on macOS, Ctrl-K
 * elsewhere. `preventDefault` stops the browser's built-in focus-address-bar
 * behaviour on some platforms. The handler toggles, so pressing it again closes
 * an open palette.
 */
export function useCommandShortcut(onToggle: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onToggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}
