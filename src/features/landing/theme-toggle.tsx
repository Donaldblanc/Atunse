"use client";

// Applies data-theme="dark"/"light" to the nearest .landing wrapper.
// Defaults to light on first paint (matches landing-theme.css's default,
// so there's no server/client mismatch), then on mount adopts the system
// preference or a saved choice, and lets the visitor override manually.
import { useEffect, useState } from "react";

const STORAGE_KEY = "atunse-landing-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.getElementById("landing-root")?.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className="theme-switch"
      data-theme={theme}
      onClick={toggle}
      aria-label="Toggle dark mode"
      aria-pressed={theme === "dark"}
    >
      <span className="theme-switch-knob">
        <svg className="theme-switch-icon-moon" width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
          <path d="M216 152A96 96 0 1 1 104 40a76 76 0 0 0 112 112Z" fill="currentColor" />
        </svg>
        <svg className="theme-switch-icon-sun" width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
          <circle cx="128" cy="128" r="48" fill="currentColor" />
          <path
            d="M128 24v24M128 208v24M24 128h24M208 128h24M56 56l17 17M183 183l17 17M56 200l17-17M183 73l17-17"
            stroke="currentColor"
            strokeWidth="16"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </button>
  );
}
