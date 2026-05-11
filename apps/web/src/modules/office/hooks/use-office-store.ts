"use client";

import { create } from "zustand";

export type OfficeView = "iso" | "cards";

type OfficeState = {
  view: OfficeView;
  zoom: number;
  selectedId: string | null;
  inspectorOpen: boolean;
  setView: (next: OfficeView) => void;
  setZoom: (next: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  select: (id: string | null) => void;
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
  setView: (next) => set({ view: next }),
  setZoom: (next) => set({ zoom: clamp(next, ZOOM_MIN, ZOOM_MAX) }),
  zoomIn: () => set({ zoom: clamp(get().zoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX) }),
  zoomOut: () => set({ zoom: clamp(get().zoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX) }),
  resetZoom: () => set({ zoom: 1 }),
  select: (id) => set({ selectedId: id, inspectorOpen: id !== null }),
  closeInspector: () => set({ inspectorOpen: false }),
}));
