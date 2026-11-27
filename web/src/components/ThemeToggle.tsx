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
      <button 
        className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-foreground/5 focus-gold"
        aria-label="Toggle Theme"
        disabled
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-foreground/5 focus-gold"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-[#D4FF00]" aria-hidden="true" />
      ) : (
        <Moon className="w-5 h-5 text-foreground" aria-hidden="true" />
      )}
    </button>
  );
}
