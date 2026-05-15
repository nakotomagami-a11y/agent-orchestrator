"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClaudeLimitsStore } from "@/lib/claude-limits-store";
import { useProcessesStore } from "@/lib/processes-store";
import { useCompareStore } from "@/lib/compare-store";
import { useOfficeStore, type AgentTab } from "@/modules/office/hooks/use-office-store";

const AGENT_TABS: AgentTab[] = ["conversation", "configuration", "history", "memory", "settings"];
function isAgentTab(v: string | null): v is AgentTab {
  return AGENT_TABS.includes(v as AgentTab);
}

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
  const closeCompare = useCompareStore((s) => s.close);

  const inspectorOpen       = useOfficeStore((s) => s.inspectorOpen);
  const selectedId          = useOfficeStore((s) => s.selectedId);
  const selectedInstanceId  = useOfficeStore((s) => s.selectedInstanceId);
  const activeTab           = useOfficeStore((s) => s.activeTab);
  const select              = useOfficeStore((s) => s.select);
  const closeInspector      = useOfficeStore((s) => s.closeInspector);

  // Prevent the store-watch effect from firing while we're applying URL state.
  const applyingUrl = useRef(false);

  // ── Mount: read URL → open modal ──────────────────────────────────────────
  useEffect(() => {
    const modal = params.get("modal");
    if (!modal) return;
    applyingUrl.current = true;
    switch (modal) {
      case "limits":
        setLimitsOpen(true);
        break;
      case "processes":
        setProcessesOpen(true);
        break;
      case "compare": {
        const runId = params.get("run");
        if (runId) openCompare(runId);
        break;
      }
      case "agent": {
        const agentId = params.get("agent");
        const tab = params.get("tab");
        const instanceId = params.get("instance");
        if (agentId) {
          select(agentId, {
            tab: isAgentTab(tab) ? tab : undefined,
            instanceId: instanceId ?? null,
          });
        }
        break;
      }
    }
    setTimeout(() => { applyingUrl.current = false; }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Store → URL ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (applyingUrl.current) return;
    const url = new URL(window.location.href);
    const prev = url.searchParams.get("modal");

    if (limitsOpen) {
      url.searchParams.set("modal", "limits");
      for (const k of ["run", "agent", "tab", "instance"]) url.searchParams.delete(k);
    } else if (processesOpen) {
      url.searchParams.set("modal", "processes");
      for (const k of ["run", "agent", "tab", "instance"]) url.searchParams.delete(k);
    } else if (compareOpen && compareRunId) {
      url.searchParams.set("modal", "compare");
      url.searchParams.set("run", compareRunId);
      for (const k of ["agent", "tab", "instance"]) url.searchParams.delete(k);
    } else if (inspectorOpen && selectedId) {
      url.searchParams.set("modal", "agent");
      url.searchParams.set("agent", selectedId);
      if (selectedInstanceId) url.searchParams.set("instance", selectedInstanceId);
      else url.searchParams.delete("instance");
      if (activeTab && activeTab !== "conversation") url.searchParams.set("tab", activeTab);
      else url.searchParams.delete("tab");
      for (const k of ["run"]) url.searchParams.delete(k);
    } else {
      url.searchParams.delete("modal");
      for (const k of ["run", "agent", "tab", "instance"]) url.searchParams.delete(k);
    }

    const next = url.pathname + url.search;
    const current = window.location.pathname + window.location.search;
    if (next !== current) {
      // push when opening (adds history entry so back closes it),
      // replace when closing (don't pollute history with closed state)
      const opening = !prev && url.searchParams.has("modal");
      if (opening) router.push(next, { scroll: false });
      else router.replace(next, { scroll: false });
    }
  }, [limitsOpen, processesOpen, compareOpen, compareRunId, inspectorOpen, selectedId, selectedInstanceId, activeTab, router]);

  return null;
}
