"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Portal } from "@/components/ui/portal";
import { useOfficeAgents } from "../../hooks/use-office-agents";
import { useOfficeStore, type AgentTab } from "../../hooks/use-office-store";
import { ChatPanel } from "@/modules/summon/components/chat-panel";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { useRunStream } from "@/modules/summon/hooks/use-run-stream";
import { ConfigurationTab } from "./tabs/configuration-tab";
import { HistoryTab } from "./tabs/history-tab";
import { MemoryTab } from "./tabs/memory-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { Icon } from "@/components/ui/icon";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject } from "@/modules/projects/hooks/use-projects";
import { AgentAvatar } from "@/components/ui/agent-avatar";

type Tab = AgentTab;

const TABS: { id: Tab; label: string }[] = [
  { id: "conversation", label: "Conversation" },
  { id: "configuration", label: "Configuration" },
  { id: "history", label: "History" },
  { id: "memory", label: "Memory" },
  { id: "settings", label: "Settings" },
];

export function AgentDetailsModal() {
  const selectedId = useOfficeStore((s) => s.selectedId);
  const selectedInstanceId = useOfficeStore((s) => s.selectedInstanceId);
  const inspectorOpen = useOfficeStore((s) => s.inspectorOpen);
  const closeInspector = useOfficeStore((s) => s.closeInspector);
  const setActiveTab = useOfficeStore((s) => s.setActiveTab);
  const activeProjectId = useActiveProjectStore((s) => s.id);
  const consumePendingTab = useOfficeStore((s) => s.consumePendingTab);
  const selectAgent = useOfficeStore((s) => s.select);
  const { agents } = useOfficeAgents();
  const agent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  const projectQ = useProject(activeProjectId);
  const rosterAgentIds = projectQ.data?.meta.roster
    ? Array.from(new Set(projectQ.data.meta.roster.map((inst) => inst.agentId)))
    : null;
  const rosterInstances = projectQ.data?.meta.roster ?? [];
  const rosterAgents = rosterAgentIds
    ? rosterAgentIds
        .map((id) => agents.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => !!a)
    : [];
  const [tab, setTab] = useState<Tab>("conversation");
  const changeTab = (t: Tab) => { setTab(t); setActiveTab(t); };
  const [newThreadSignal, setNewThreadSignal] = useState(0);
  const [branchSignal, setBranchSignal] = useState(0);

  const runsQ = useRuns({
    agentId: agent?.id,
    instanceId: selectedInstanceId ?? undefined,
    limit: 50,
  });

  // Track active run id to show live usage in header
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const stream = useRunStream(activeRunId);

  useEffect(() => {
    if (inspectorOpen) {
      const pending = consumePendingTab();
      changeTab(pending ?? "conversation");
    }
  }, [inspectorOpen, selectedId, consumePendingTab]);

  const memoryDiscardRef = useRef<(() => void) | null>(null);
  const settingsResetRef = useRef<(() => void) | null>(null);

  // Close on Escape
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!inspectorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeInspector();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inspectorOpen, closeInspector]);

  if (!inspectorOpen || !agent) return null;

  const runCount = runsQ.data?.length ?? 0;

  const isStreamActive =
    stream.phase === "starting" ||
    stream.phase === "streaming";
  const effectiveStatus = isStreamActive ? "working" : agent.status;

  const isWorking = effectiveStatus === "working" || effectiveStatus === "thinking";

  const usage = stream.usage;

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-8 z-[100] bg-[radial-gradient(ellipse_1200px_700px_at_50%_35%,rgba(43,30,24,0.6),rgba(10,8,7,0.95)_80%)] after:content-[''] after:absolute after:inset-0 after:[backdrop-filter:blur(14px)_saturate(0.85)] after:[-webkit-backdrop-filter:blur(14px)_saturate(0.85)] after:bg-[rgba(20,16,14,0.55)] after:pointer-events-none"
        role="presentation"
        onClick={closeInspector}
      >
        <div
          ref={ref}
          className="ao-modal relative w-full max-w-[1080px] h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] bg-[var(--ao-bg-1)] border border-[var(--ao-line-1)] rounded-[var(--ao-radius-xl)] shadow-[var(--ao-shadow-modal)] flex flex-col overflow-hidden z-[1] text-[var(--ao-fg-0)] text-[14px] leading-[1.45] [-webkit-font-smoothing:antialiased]"
          role="dialog"
          aria-modal="true"
          aria-label={`Agent: ${agent.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Tab bar ── */}
          <div className="flex items-stretch px-2 border-b border-ao-line-1 bg-gradient-to-b from-white/[0.02] to-transparent h-[var(--ao-tab-h)] shrink-0 relative" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`relative inline-flex items-center gap-2 px-[18px] h-full text-[13px] font-medium tracking-[0.01em] whitespace-nowrap transition-colors duration-[120ms] ${tab === t.id ? "text-[var(--ao-fg-0)] font-semibold" : "text-[var(--ao-fg-2)] hover:text-[var(--ao-fg-1)]"}`}
                onClick={() => changeTab(t.id)}
                type="button"
              >
                <span>{t.label}</span>
                {t.id === "history" && runCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[6px] rounded-[9px] bg-ao-bg-3 text-ao-fg-1 text-[11px] font-semibold border border-ao-line-1">{runCount}</span>
                )}
                {tab === t.id && (
                  <span className="absolute left-3 right-3 bottom-[-1px] h-[2px] bg-[var(--ao-accent)] rounded-[2px]" />
                )}
              </button>
            ))}
            <div className="flex-1" />
            <button
              className="inline-flex items-center justify-center w-8 h-8 my-auto mr-1 rounded-lg text-ao-fg-2 hover:text-ao-fg-0 hover:bg-ao-bg-3"
              aria-label="Close"
              onClick={closeInspector}
              type="button"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* ── Body row: agent strip + content ── */}
          <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          {/* Agent switcher strip - only shown when inside a project with multiple agents */}
          {rosterAgents.length > 1 && (
            <div className="ao-agent-strip flex flex-col items-center gap-1 py-[10px] w-[52px] shrink-0 border-r border-[var(--ao-line-0)] overflow-y-auto [scrollbar-width:none]">
              {rosterAgents.map((a) => {
                const inst = rosterInstances.find((r) => r.agentId === a.id);
                const isActive = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    title={a.name}
                    className={`relative w-[38px] h-[38px] rounded-[10px] border-2 cursor-pointer flex items-center justify-center transition-[background,border-color] duration-[120ms] shrink-0 hover:bg-[var(--ao-bg-2)] ${isActive ? "border-[var(--ao-accent)] bg-[var(--ao-bg-2)]" : "border-transparent bg-transparent"}`}
                    onClick={() => selectAgent(a.id, { tab, instanceId: inst?.instanceId ?? null })}
                  >
                    <AgentAvatar unit={a.unitChoice} size={30} label={a.name} />
                    {a.status === "working" || a.status === "thinking" ? (
                      <span className="absolute bottom-[1px] right-[1px] w-2 h-2 rounded-full border-[1.5px] border-[var(--ao-bg-1)] bg-[var(--ao-ok)] animate-[ao-pulse_1.4s_ease-in-out_infinite]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* ── Agent header ── */}
          <div className="flex items-center gap-[14px] px-6 py-4 border-b border-ao-line-1 bg-gradient-to-b from-white/[0.015] to-transparent shrink-0 min-h-[var(--ao-header-h)]">
            <div className="relative w-[40px] h-[40px] rounded-[10px] bg-ao-bg-3 border border-ao-line-1 overflow-hidden shrink-0 grid place-items-center [image-rendering:pixelated]">
              <span className="text-[22px]">{agent.short[0]?.toUpperCase() ?? "?"}</span>
              <span className={`absolute right-[-2px] bottom-[-2px] w-[12px] h-[12px] rounded-full border-2 border-[var(--ao-bg-1)] ${
                isWorking
                  ? "bg-[var(--ao-ok)] shadow-[0_0_6px_var(--ao-ok)] animate-[ao-pulse_1.5s_infinite]"
                  : "bg-[var(--ao-fg-3)]"
              }`} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="font-bold text-base text-ao-fg-0">{agent.name}</div>
              <div className="flex items-center gap-2 text-ao-fg-2 font-mono text-[12px]">
                <span>{agent.id}</span>
                <span className="w-[3px] h-[3px] bg-ao-fg-3 rounded-full" />
                <span>{agent.defaultModel ?? "default"}</span>
                <span className="w-[3px] h-[3px] bg-ao-fg-3 rounded-full" />
                <span>effort {agent.defaultEffort ?? "default"}</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="inline-flex items-center gap-[6px] h-[28px] px-3 rounded-[8px] bg-[var(--ao-bg-3)] border border-[var(--ao-line-1)] text-[var(--ao-fg-1)] font-mono text-[11.5px] tracking-[0.02em]">
                <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${isWorking ? "bg-[var(--ao-ok)] shadow-[0_0_6px_var(--ao-ok)] animate-[ao-pulse_1.5s_infinite]" : "bg-[var(--ao-fg-3)]"}`} />
                {effectiveStatus}
              </span>
              {tab === "conversation" && (
                <>
                  <span className="inline-flex items-center gap-[10px] h-7 px-3 rounded-lg bg-ao-bg-3 border border-ao-line-1 font-mono text-[11.5px] text-ao-fg-1">
                    <span className="text-ao-fg-2">{(usage.tokensIn + usage.tokensOut).toLocaleString()} tok</span>
                    <span className="text-ao-fg-0">${usage.cost.toFixed(4)}</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-4 hover:text-ao-fg-0 hover:border-ao-line-2"
                    onClick={() => setBranchSignal((n) => n + 1)}
                  >
                    <Icon name="branch-ao" size={13} /> Branch
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-4 hover:text-ao-fg-0 hover:border-ao-line-2"
                    onClick={() => setNewThreadSignal((n) => n + 1)}
                  >
                    <Icon name="plus" size={13} /> New
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-transparent border-transparent text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-3"
                    aria-label="Edit agent"
                    onClick={() => changeTab("settings")}
                  >
                    <Icon name="edit" size={13} />
                  </button>
                </>
              )}
              {tab === "configuration" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-4 hover:text-ao-fg-0 hover:border-ao-line-2"
                  onClick={() => changeTab("settings")}
                >
                  <Icon name="edit" size={13} /> Edit
                </button>
              )}
              {tab === "memory" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-4 hover:text-ao-fg-0 hover:border-ao-line-2"
                  onClick={() => memoryDiscardRef.current?.()}
                >
                  <Icon name="refresh" size={13} /> Discard
                </button>
              )}
              {tab === "settings" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-4 hover:text-ao-fg-0 hover:border-ao-line-2"
                  onClick={() => settingsResetRef.current?.()}
                >
                  <Icon name="refresh" size={13} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="ao-modal-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-color:var(--ao-bg-4)_transparent] [scrollbar-width:thin] relative flex flex-col">
            {tab === "conversation" && (
              <ChatPanel
                agent={agent}
                projectId={activeProjectId ?? undefined}
                instanceId={selectedInstanceId ?? undefined}
                onClose={closeInspector}
                onEdit={() => changeTab("settings")}
                onNavigateTab={(tab) => changeTab(tab)}
                noHeader
                newThreadSignal={newThreadSignal}
                branchSignal={branchSignal}
                onActiveRunChange={setActiveRunId}
              />
            )}
            {tab === "configuration" && <ConfigurationTab agent={agent} />}
            {tab === "history" && (
              <HistoryTab agentId={agent.id} />
            )}
            {tab === "memory" && <MemoryTab agentId={agent.id} discardRef={memoryDiscardRef} />}
            {tab === "settings" && (
              <SettingsTab
                agentId={agent.id}
                onAfterSave={() => changeTab("configuration")}
                onAfterDelete={closeInspector}
                resetRef={settingsResetRef}
              />
            )}
          </div>
          </div>{/* content-col */}
          </div>{/* body-row */}
        </div>
      </div>
    </Portal>
  );
}
