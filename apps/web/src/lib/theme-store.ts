import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "agent-office:theme";
const DOC_ATTR = "data-theme";

type ThemeState = {
  theme: Theme;
  hydrated: boolean;
  setTheme: (next: Theme) => void;
  toggle: () => void;
  hydrate: () => void;
};

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // localStorage may be unavailable (privacy modes, SSR)
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function writeDom(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(DOC_ATTR, theme);
}

function persist(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  // SSR-safe default — matches `data-theme="light"` set on <html> in layout.tsx.
  theme: "light",
  hydrated: false,
  setTheme: (next) => {
    writeDom(next);
    persist(next);
    set({ theme: next });
  },
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
  hydrate: () => {
    if (get().hydrated) return;
    const stored = readStoredTheme();
    writeDom(stored);
    set({ theme: stored, hydrated: true });
  },
}));

/**
 * Mount-time hook. Call once near the root (e.g. inside the TitleBar that lives in
 * every layout) so the store reads the persisted value and aligns the DOM
 * attribute. Skips work after the first hydration to avoid render loops.
 */
export function useThemeHydration() {
  const hydrate = useThemeStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}
