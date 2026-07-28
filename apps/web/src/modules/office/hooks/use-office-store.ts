"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { getUiSettings, patchUiSettings } from "@/lib/api/ui-settings";

export type OfficeView = "iso" | "cards";

/**
 * Tabs surfaced by `AgentDetailsModal`. Exported here (instead of inside the
 * modal) so other surfaces can pre-select a tab when opening the inspector -
 * e.g. clicking the edit icon on an agent card jumps straight to "prompt".
 */
export type AgentTab = "conversation" | "history" | "memory" | "settings";

type SelectOptions = { tab?: AgentTab; instanceId?: string | null };

type OfficeState = {
  view: OfficeView;
  /**
   * Master capability gate for the isometric renderer (dev-menu toggle). When
   * false the iso floor is never loaded, the in-app iso/cards switch is hidden,
   * and only the flat card grid is reachable. `view` is still remembered so
   * re-enabling restores the user's last iso/cards choice.
   */
  isoEnabled: boolean;
  selectedId: string | null;
  /** Roster instance under selection (one of selectedId's `AgentInstance`s). */
  selectedInstanceId: string | null;
  inspectorOpen: boolean;
  /** When set, the modal opens on this tab once and then clears it. */
  pendingTab: AgentTab | null;
  /** Currently visible tab - kept in sync by AgentDetailsModal. */
  activeTab: AgentTab;
  /**
   * Per-project set of agentIds whose roster group is expanded.
   * Keyed by projectId. Only populated when features.multiInstance is on.
   */
  expandedGroups: Record<string, string[]>;
  /**
   * Per-project set of agentIds pinned to the top of the roster.
   * Keyed by projectId, same shape as `expandedGroups`.
   */
  pinnedGroups: Record<string, string[]>;
  setView: (next: OfficeView) => void;
  setIsoEnabled: (next: boolean) => void;
  select: (id: string | null, opts?: SelectOptions) => void;
  consumePendingTab: () => AgentTab | null;
  closeInspector: () => void;
  setActiveTab: (tab: AgentTab) => void;
  toggleGroup: (projectId: string, agentId: string) => void;
  setGroupExpanded: (projectId: string, agentId: string, expanded: boolean) => void;
  togglePin: (projectId: string, agentId: string) => void;
  hydrated: boolean;
  hydrate: () => void;
};

/**
 * Persistence — the subset of office UI *preferences* worth remembering across
 * sessions. Stored server-side in `ui_settings["office-view"]` (same pattern as
 * theme/tabs) so it survives a webview storage wipe, unlike the old
 * localStorage-only zustand `persist`. Ephemeral selection/inspector state is
 * deliberately excluded.
 */
const STORAGE_KEY = "office-view";

type Persisted = Pick<OfficeState, "view" | "isoEnabled" | "expandedGroups" | "pinnedGroups">;

const isGroupMap = (v: unknown): v is Record<string, string[]> =>
  !!v && typeof v === "object" && !Array.isArray(v) &&
  Object.values(v).every((a) => Array.isArray(a) && a.every((s) => typeof s === "string"));

function parsePersisted(raw: unknown): Partial<Persisted> | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    // Unwrap the old zustand-persist envelope (`{ state, version }`) if present,
    // so a user's local pins/expansions migrate to the server on first boot.
    const s = (o && typeof o.state === "object" ? o.state : o) as Record<string, unknown>;
    const out: Partial<Persisted> = {};
    if (s.view === "iso" || s.view === "cards") out.view = s.view;
    if (typeof s.isoEnabled === "boolean") out.isoEnabled = s.isoEnabled;
    if (isGroupMap(s.expandedGroups)) out.expandedGroups = s.expandedGroups;
    if (isGroupMap(s.pinnedGroups)) out.pinnedGroups = s.pinnedGroups;
    return out;
  } catch {
    return null;
  }
}

export const useOfficeStore = create<OfficeState>()((set, get) => {
  const save = () => {
    const s = get();
    const slice: Persisted = {
      view: s.view, isoEnabled: s.isoEnabled,
      expandedGroups: s.expandedGroups, pinnedGroups: s.pinnedGroups,
    };
    patchUiSettings({ [STORAGE_KEY]: JSON.stringify(slice) }).catch(() => { /* best-effort */ });
  };
  return {
  view: "iso",
  isoEnabled: true,
  selectedId: null,
  selectedInstanceId: null,
  inspectorOpen: false,
  pendingTab: null,
  activeTab: "conversation",
  expandedGroups: {},
  pinnedGroups: {},
  hydrated: false,
  setView: (next) => { set({ view: next }); save(); },
  setIsoEnabled: (next) => { set({ isoEnabled: next }); save(); },
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
  toggleGroup: (projectId, agentId) => {
    const current = get().expandedGroups;
    const ids = current[projectId] ?? [];
    const isExpanded = ids.includes(agentId);
    set({
      expandedGroups: {
        ...current,
        [projectId]: isExpanded ? ids.filter((id) => id !== agentId) : [...ids, agentId],
      },
    });
    save();
  },
  setGroupExpanded: (projectId, agentId, expanded) => {
    const current = get().expandedGroups;
    const ids = current[projectId] ?? [];
    const isExpanded = ids.includes(agentId);
    if (expanded === isExpanded) return;
    set({
      expandedGroups: {
        ...current,
        [projectId]: expanded ? [...ids, agentId] : ids.filter((id) => id !== agentId),
      },
    });
    save();
  },
  togglePin: (projectId, agentId) => {
    const current = get().pinnedGroups;
    const ids = current[projectId] ?? [];
    const isPinned = ids.includes(agentId);
    set({
      pinnedGroups: {
        ...current,
        [projectId]: isPinned ? ids.filter((id) => id !== agentId) : [...ids, agentId],
      },
    });
    save();
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    getUiSettings()
      .then((data) => {
        // Server is authoritative; fall back to the old localStorage blob so a
        // user's existing view/pins migrate once, then push them to the server.
        const server = parsePersisted(data[STORAGE_KEY]);
        const legacy = server
          ? null
          : parsePersisted(typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null);
        const restored = server ?? legacy;
        if (restored) {
          set(restored);
          if (legacy) save(); // migrate localStorage → server, one time
        }
      })
      .catch(() => { /* ignore — pre-migration / fresh DB */ });
  },
  };
});

/** Mount once near the app root so office preferences hydrate from the server. */
export function useOfficeHydration(): void {
  const hydrate = useOfficeStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}
