"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeId = "navy" | "light" | "dark";

interface ThemeCtx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "navy", setTheme: () => {} });

const STORAGE_KEY = "harpian-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("navy");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && ["navy", "light", "dark"].includes(saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

export function chartColors(): { bg: string; text: string; grid: string; gridH: string; border: string } {
  const s = getComputedStyle(document.documentElement);
  const get = (v: string) => s.getPropertyValue(v).trim() || undefined;
  return {
    bg: get("--panel") || "#0A1A30",
    text: get("--tx3") || "#7d96b3",
    grid: get("--line") || "#16304f",
    gridH: get("--line") || "#13283f",
    border: get("--line") || "#1d3a5f",
  };
}
