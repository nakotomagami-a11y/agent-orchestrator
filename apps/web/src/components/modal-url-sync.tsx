"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { match } from "ts-pattern";
import { useClaudeLimitsStore } from "@/lib/claude-limits-store";
import { useProcessesStore } from "@/lib/processes-store";
import { useCompareStore } from "@/lib/compare-store";
import { useOfficeStore, type AgentTab } from "@/modules/office/hooks/use-office-store";

const AGENT_TABS: AgentTab[] = ["conversation", "history", "memory", "settings"];
function isAgentTab(v: string | null): v is AgentTab {
  return AGENT_TABS.includes(v as AgentTab);
}

// Keys (besides "modal") that describe modal payloads; cleared unless kept.
const PAYLOAD_KEYS = ["run", "agent", "tab", "instance"] as const;
function clearPayload(sp: URLSearchParams, keep: readonly string[] = []) {
  for (const k of PAYLOAD_KEYS) if (!keep.includes(k)) sp.delete(k);
}

// The single source of truth for "which modal is open", resolved by priority
// from the independent modal stores.
type ModalState =
  | { kind: "limits" }
  | { kind: "processes" }
  | { kind: "compare"; runId: string }
  | { kind: "agent"; agentId: string; instanceId: string | null; tab: AgentTab | null }
  | { kind: "none" };

// Syncs ?modal= search param ↔ modal store state.
// Mount: reads URL and opens the correct modal.
// Store changes: updates URL via router.replace so back/forward works.
export function ModalUrlSync() {
  const router = useRouter();
  const params = useSearchParams();

  const limitsOpen    = useClaudeLimitsStore((s) => s.open);
  const setLimitsOpen = useClaudeLimitsStore((s) => s.setOpen);

  const processesOpen    = useProcessesStore((s) => s.open);
  const setProcessesOpen = useProcessesStore((s) => s.setOpen);

  const compareOpen  = useCompareStore((s) => s.open);
  const compareRunId = useCompareStore((s) => s.baseRunId);
  const openCompare  = useCompareStore((s) => s.openWith);

  const inspectorOpen       = useOfficeStore((s) => s.inspectorOpen);
  const selectedId          = useOfficeStore((s) => s.selectedId);
  const selectedInstanceId  = useOfficeStore((s) => s.selectedInstanceId);
  const activeTab           = useOfficeStore((s) => s.activeTab);
  const select              = useOfficeStore((s) => s.select);

  // Prevent the store-watch effect from firing while we're applying URL state.
  const applyingUrl = useRef(false);

  // ── Mount: read URL → open modal ──────────────────────────────────────────
  useEffect(() => {
    const modal = params.get("modal");
    if (!modal) return;
    applyingUrl.current = true;
    match(modal)
      .with("limits", () => setLimitsOpen(true))
      .with("processes", () => setProcessesOpen(true))
      .with("compare", () => {
        const runId = params.get("run");
        if (runId) openCompare(runId);
      })
      .with("agent", () => {
        const agentId = params.get("agent");
        if (!agentId) return;
        const tab = params.get("tab");
        const instanceId = params.get("instance");
        select(agentId, {
          tab: isAgentTab(tab) ? tab : undefined,
          instanceId: instanceId ?? null,
        });
      })
      .otherwise(() => {});
    setTimeout(() => { applyingUrl.current = false; }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Store → URL ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (applyingUrl.current) return;

    const state: ModalState =
      limitsOpen ? { kind: "limits" }
      : processesOpen ? { kind: "processes" }
      : compareOpen && compareRunId ? { kind: "compare", runId: compareRunId }
      : inspectorOpen && selectedId
        ? {
            kind: "agent",
            agentId: selectedId,
            instanceId: selectedInstanceId,
            tab: activeTab && activeTab !== "conversation" ? activeTab : null,
          }
        : { kind: "none" };

    const url = new URL(window.location.href);
    const sp = url.searchParams;
    const prev = sp.get("modal");

    match(state)
      .with({ kind: "limits" }, () => {
        sp.set("modal", "limits");
        clearPayload(sp);
      })
      .with({ kind: "processes" }, () => {
        sp.set("modal", "processes");
        clearPayload(sp);
      })
      .with({ kind: "compare" }, ({ runId }) => {
        sp.set("modal", "compare");
        sp.set("run", runId);
        clearPayload(sp, ["run"]);
      })
      .with({ kind: "agent" }, ({ agentId, instanceId, tab }) => {
        sp.set("modal", "agent");
        sp.set("agent", agentId);
        if (instanceId) sp.set("instance", instanceId);
        else sp.delete("instance");
        if (tab) sp.set("tab", tab);
        else sp.delete("tab");
        clearPayload(sp, ["agent", "instance", "tab"]);
      })
      .with({ kind: "none" }, () => {
        sp.delete("modal");
        clearPayload(sp);
      })
      .exhaustive();

    const next = url.pathname + url.search;
    const current = window.location.pathname + window.location.search;
    if (next !== current) {
      // push when opening (adds history entry so back closes it),
      // replace when closing (don't pollute history with closed state)
      const opening = !prev && sp.has("modal");
      if (opening) router.push(next, { scroll: false });
      else router.replace(next, { scroll: false });
    }
  }, [limitsOpen, processesOpen, compareOpen, compareRunId, inspectorOpen, selectedId, selectedInstanceId, activeTab, router]);

  return null;
}
