"use client";

import { create } from "zustand";

export type OfficeView = "iso" | "cards";

/**
 * Tabs surfaced by `AgentDetailsModal`. Exported here (instead of inside the
 * modal) so other surfaces can pre-select a tab when opening the inspector —
 * e.g. clicking the edit icon on an agent card jumps straight to "prompt".
 */
export type AgentTab = "conversation" | "configuration" | "history" | "memory" | "settings";

type SelectOptions = { tab?: AgentTab };

type OfficeState = {
  view: OfficeView;
  zoom: number;
  selectedId: string | null;
  inspectorOpen: boolean;
  /** When set, the modal opens on this tab once and then clears it. */
  pendingTab: AgentTab | null;
  setView: (next: OfficeView) => void;
  setZoom: (next: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  select: (id: string | null, opts?: SelectOptions) => void;
  consumePendingTab: () => AgentTab | null;
  closeInspector: () => void;
};

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

export const useOfficeStore = create<OfficeState>((set, get) => ({
  view: "iso",
  zoom: 1,
  selectedId: null,
  inspectorOpen: false,
  pendingTab: null,
  setView: (next) => set({ view: next }),
  setZoom: (next) => set({ zoom: clamp(next, ZOOM_MIN, ZOOM_MAX) }),
  zoomIn: () => set({ zoom: clamp(get().zoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX) }),
  zoomOut: () => set({ zoom: clamp(get().zoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX) }),
  resetZoom: () => set({ zoom: 1 }),
  select: (id, opts) =>
    set({
      selectedId: id,
      inspectorOpen: id !== null,
      pendingTab: id !== null ? opts?.tab ?? null : null,
    }),
  consumePendingTab: () => {
    const t = get().pendingTab;
    if (t) set({ pendingTab: null });
    return t;
  },
  closeInspector: () => set({ inspectorOpen: false, pendingTab: null }),
}));
