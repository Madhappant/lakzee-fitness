"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return (
      <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-foreground/5">
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-foreground/5"
      aria-label="Toggle Theme"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-brand-gold" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
