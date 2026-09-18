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
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
          <path
            d="M216 128C216 176.6 176.6 216 128 216C79.4 216 40 176.6 40 128C40 79.4 79.4 40 128 40"
            stroke="currentColor"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <circle cx="128" cy="128" r="40" fill="currentColor" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}
