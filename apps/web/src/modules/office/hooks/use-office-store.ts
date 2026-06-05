"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  setView: (next: OfficeView) => void;
  select: (id: string | null, opts?: SelectOptions) => void;
  consumePendingTab: () => AgentTab | null;
  closeInspector: () => void;
  setActiveTab: (tab: AgentTab) => void;
  toggleGroup: (projectId: string, agentId: string) => void;
  setGroupExpanded: (projectId: string, agentId: string, expanded: boolean) => void;
};

export const useOfficeStore = create<OfficeState>()(persist((set, get) => ({
  view: "iso",
  selectedId: null,
  selectedInstanceId: null,
  inspectorOpen: false,
  pendingTab: null,
  activeTab: "conversation",
  expandedGroups: {},
  setView: (next) => set({ view: next }),
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
  },
}), {
  name: "office-view",
  partialize: (s) => ({ view: s.view, expandedGroups: s.expandedGroups }),
}));
