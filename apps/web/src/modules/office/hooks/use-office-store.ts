"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OfficeView = "iso" | "cards";

/**
 * Tabs surfaced by `AgentDetailsModal`. Exported here (instead of inside the
 * modal) so other surfaces can pre-select a tab when opening the inspector —
 * e.g. clicking the edit icon on an agent card jumps straight to "prompt".
 */
export type AgentTab = "conversation" | "configuration" | "history" | "memory" | "settings";

type SelectOptions = { tab?: AgentTab; instanceId?: string | null };

type OfficeState = {
  view: OfficeView;
  zoom: number;
  selectedId: string | null;
  /** Roster instance under selection (one of selectedId's `AgentInstance`s). */
  selectedInstanceId: string | null;
  inspectorOpen: boolean;
  /** When set, the modal opens on this tab once and then clears it. */
  pendingTab: AgentTab | null;
  /** Currently visible tab — kept in sync by AgentDetailsModal. */
  activeTab: AgentTab;
  setView: (next: OfficeView) => void;
  setZoom: (next: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  select: (id: string | null, opts?: SelectOptions) => void;
  consumePendingTab: () => AgentTab | null;
  closeInspector: () => void;
  setActiveTab: (tab: AgentTab) => void;
};

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

export const useOfficeStore = create<OfficeState>()(persist((set, get) => ({
  view: "iso",
  zoom: 1,
  selectedId: null,
  selectedInstanceId: null,
  inspectorOpen: false,
  pendingTab: null,
  activeTab: "conversation",
  setView: (next) => set({ view: next }),
  setZoom: (next) => set({ zoom: clamp(next, ZOOM_MIN, ZOOM_MAX) }),
  zoomIn: () => set({ zoom: clamp(get().zoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX) }),
  zoomOut: () => set({ zoom: clamp(get().zoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX) }),
  resetZoom: () => set({ zoom: 1 }),
  select: (id, opts) =>
    set({
      selectedId: id,
      selectedInstanceId: id !== null ? opts?.instanceId ?? null : null,
      inspectorOpen: id !== null,
      pendingTab: id !== null ? opts?.tab ?? null : null,
    }),
  consumePendingTab: () => {
    const t = get().pendingTab;
    if (t) set({ pendingTab: null });
    return t;
  },
  closeInspector: () => set({ inspectorOpen: false, pendingTab: null, selectedInstanceId: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}), {
  name: "office-view",
  partialize: (s) => ({ view: s.view }),
}));
