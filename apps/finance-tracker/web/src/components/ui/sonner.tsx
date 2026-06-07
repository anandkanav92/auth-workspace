import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/lib/theme";

/**
 * Toast host. shadcn ships a Sonner wrapper that reads the active theme so
 * toasts match light/dark. We resolve the *effective* theme (system -> the OS
 * preference) from our own ThemeProvider rather than next-themes.
 */
function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--fg)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
