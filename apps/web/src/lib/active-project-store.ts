import { useEffect } from "react";
import { create } from "zustand";

type ActiveProjectState = {
  id: string | null;
  hydrated: boolean;
  setId: (next: string | null) => void;
  hydrate: () => void;
};

export const useActiveProjectStore = create<ActiveProjectState>((set, get) => ({
  id: null,
  hydrated: false,
  setId: (next) => {
    set({ id: next });
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "active-project": next ?? "" }),
    }).catch(() => { /* best-effort */ });
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    fetch("/api/ui-settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const stored = data["active-project"];
        set({ id: stored && stored.length > 0 ? stored : null });
      })
      .catch(() => { /* ignore */ });
  },
}));

export function useActiveProjectHydration() {
  const hydrate = useActiveProjectStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}
