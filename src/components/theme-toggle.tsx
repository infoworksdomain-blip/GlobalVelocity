"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/** Explicit light/dark override. Dark is the default identity (bare :root in globals.css); this writes
 * data-theme + localStorage so the choice persists and wins over system preference in both directions.
 * The actual FOUC-safe initial read happens in the inline script in src/app/layout.tsx -- this component
 * only needs to reflect/update state after hydration. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    const systemLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(attr === "light" || (!attr && systemLight) ? "light" : "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch { /* private mode / storage blocked -- toggle still works this session */ }
    setTheme(next);
  };
  return (
    <button onClick={toggle} className={`btn-ghost px-2 ${className}`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
