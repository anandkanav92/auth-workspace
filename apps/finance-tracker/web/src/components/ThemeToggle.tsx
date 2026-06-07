import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "@/lib/theme";

const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

/**
 * Cycles the theme preference light -> dark -> system. The icon reflects the
 * *current* preference; the aria-label announces what a click will switch to.
 */
export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}
