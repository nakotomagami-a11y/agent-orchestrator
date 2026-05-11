import { useEffect } from "react";
import { create } from "zustand";

const STORAGE_KEY = "agent-office:active-project";

type ActiveProjectState = {
  id: string | null;
  hydrated: boolean;
  setId: (next: string | null) => void;
  hydrate: () => void;
};

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function persist(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const useActiveProjectStore = create<ActiveProjectState>((set, get) => ({
  id: null,
  hydrated: false,
  setId: (next) => {
    persist(next);
    set({ id: next });
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({ id: readStored(), hydrated: true });
  },
}));

export function useActiveProjectHydration() {
  const hydrate = useActiveProjectStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}
