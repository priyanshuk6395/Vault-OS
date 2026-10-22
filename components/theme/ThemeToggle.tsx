"use client";

import { useRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedTheme = theme ?? "system";

  const selectByArrow = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + themes.length) % themes.length;
    setTheme(themes[nextIndex].value);
    buttonsRef.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-border bg-subtle p-1", className)}
    >
      {themes.map(({ value, label, Icon }, index) => (
        <button
          key={value}
          ref={(element) => { buttonsRef.current[index] = element; }}
          type="button"
          role="radio"
          aria-label={`${label} theme`}
          aria-checked={selectedTheme === value}
          title={`${label} theme`}
          tabIndex={selectedTheme === value ? 0 : -1}
          onClick={() => setTheme(value)}
          onKeyDown={(event) => selectByArrow(event, index)}
          className={cn(
            "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selectedTheme === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon aria-hidden="true" size={14} />
          <span className="sr-only sm:not-sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}