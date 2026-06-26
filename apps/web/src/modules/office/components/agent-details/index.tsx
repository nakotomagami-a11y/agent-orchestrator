"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/ui/portal";
import { useOfficeAgents } from "../../hooks/use-office-agents";
import { useOfficeStore, type AgentTab } from "../../hooks/use-office-store";
import { ChatPanel } from "@/modules/summon/components/chat-panel";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { useRunStream } from "@/modules/summon/hooks/use-run-stream";
import { HistoryTab } from "./tabs/history-tab";
import { MemoryTab } from "./tabs/memory-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject, useAddInstance, useRemoveInstance } from "@/modules/projects/hooks/use-projects";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { useSettings } from "@/modules/settings/hooks/use-settings";
import type { AgentInstance } from "@agent-office/shared/types";
import type { OfficeAgent } from "../../hooks/use-office-agents";
import type { AgentStatusInfo } from "../../utils/derive-status";

type Tab = AgentTab;

const TABS: { id: Tab; label: string }[] = [
  { id: "conversation", label: "Conversation" },
  { id: "history", label: "History" },
  { id: "memory", label: "Memory" },
  { id: "settings", label: "Settings" },
];

// ── Instance overview card ─────────────────────────────────────────────────

function InstanceCard({
  instance,
  index,
  agent,
  lastLine,
  status,
  isSelected,
  onSelect,
}: {
  instance: AgentInstance;
  index: number;
  agent: OfficeAgent;
  lastLine: string;
  status: AgentStatusInfo["status"];
  isSelected: boolean;
  onSelect: (instanceId: string) => void;
}) {
  const label = instance.label
    ? `#${index + 1} · ${instance.label}`
    : `#${index + 1}`;

  const isWorking = status === "working" || status === "thinking";

  return (
    <button
      type="button"
      onClick={() => onSelect(instance.instanceId)}
      className={`flex flex-col gap-2 p-3 rounded-[10px] border text-left transition-[background,border-color] duration-[120ms] cursor-pointer ${
        isSelected
          ? "border-[var(--ao-accent)] bg-[var(--ao-bg-2)]"
          : "border-ao-line-1 bg-ao-bg-2 hover:bg-ao-bg-3 hover:border-ao-line-2"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 rounded-[8px] bg-ao-bg-3 border border-ao-line-1 grid place-items-center shrink-0">
          <AgentAvatar unit={agent.unitChoice} size={26} label={agent.name} />
          <span
            className={`absolute right-[-2px] bottom-[-2px] w-[9px] h-[9px] rounded-full border-[1.5px] border-[var(--ao-bg-1)] ${
              isWorking
                ? "bg-[var(--ao-ok)] shadow-[0_0_5px_var(--ao-ok)] animate-[ao-pulse_1.5s_infinite]"
                : "bg-[var(--ao-fg-3)]"
            }`}
          />
        </div>
        <div className="font-mono text-[12px] font-semibold text-ao-fg-0 min-w-0 truncate">
          {label}
        </div>
        {instance.worktreeMissing && (
          <span
            title="Git worktree missing — open this instance and click Repair worktree"
            className="ml-auto inline-flex items-center gap-1 shrink-0 px-[6px] h-[18px] rounded-[9px] bg-[var(--ao-bad-soft)] text-[var(--ao-bad)] text-[10px] font-semibold border border-[rgba(217,83,79,0.30)]"
          >
            <Icon name="wrench" size={10} /> repair
          </span>
        )}
      </div>
      <div className="font-mono text-[11px] text-ao-fg-2 leading-[1.4] line-clamp-2 min-h-[28px]">
        {lastLine}
      </div>
    </button>
  );
}

// ── Overview panel ─────────────────────────────────────────────────────────

function InstanceOverview({
  agent,
  instances,
  selectedInstanceId,
  onSelect,
  onBack,
}: {
  agent: OfficeAgent;
  instances: AgentInstance[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onBack: () => void;
}) {
  const runsQ = useRuns({ agentId: agent.id, limit: 200 });
  const runs = runsQ.data ?? [];

  // Get last output line per instance
  const lastLineByInstance = (instanceId: string): string => {
    const instRuns = runs
      .filter((r) => r.instanceId === instanceId)
      .sort((a, b) => b.ts - a.ts);
    const lastRun = instRuns[0];
    if (!lastRun) return "No activity";
    const lines = (lastRun.output ?? lastRun.prompt ?? "").trim().split("\n");
    const last = lines[lines.length - 1]?.trim() ?? "";
    return last || lastRun.prompt || "No activity";
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Back button in header area */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-ao-line-1 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-4 hover:text-ao-fg-0 hover:border-ao-line-2"
        >
          <span className="rotate-180 inline-flex"><Icon name="chevron" size={13} /></span> Back
        </button>
        <span className="text-ao-fg-2 text-[13px]">
          All instances of{" "}
          <span className="text-ao-fg-0 font-semibold">{agent.name}</span>
        </span>
      </div>

      {/* Grid of instance cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {instances.map((inst, idx) => (
            <InstanceCard
              key={inst.instanceId}
              instance={inst}
              index={idx}
              agent={agent}
              lastLine={lastLineByInstance(inst.instanceId)}
              status={agent.status}
              isSelected={selectedInstanceId === inst.instanceId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

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

  const settingsQ = useSettings();
  const isMultiInstance = settingsQ.data?.features?.multiInstance === true;

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

  // Instances for the currently selected agent
  const agentInstances = rosterInstances.filter(
    (i) => i.agentId === selectedId,
  );
  const isMultiAgentSelected = isMultiInstance && agentInstances.length > 1;

  // Overview mode: local state only, not persisted
  const [showOverview, setShowOverview] = useState(false);

  // Reset overview when agent changes
  useEffect(() => {
    setShowOverview(false);
  }, [selectedId]);

  const addMut = useAddInstance();
  const removeMut = useRemoveInstance();

  const [tab, setTab] = useState<Tab>("conversation");
  const changeTab = (t: Tab) => { setTab(t); setActiveTab(t); };
  const [newThreadSignal, setNewThreadSignal] = useState(0);

  const handleNewConversation = async () => {
    if (!activeProjectId || !selectedId) {
      setNewThreadSignal((n) => n + 1);
      return;
    }
    try {
      const data = await new Promise<{ instance: AgentInstance }>((resolve, reject) => {
        addMut.mutate({ projectId: activeProjectId, agentId: selectedId }, {
          onSuccess: (d) => resolve(d),
          onError: reject,
        });
      });
      selectAgent(selectedId, { instanceId: data.instance.instanceId, tab: "conversation" });
    } catch {
      setNewThreadSignal((n) => n + 1);
    }
  };

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

  // ── Alt+← / Alt+→ / Alt+↑ keyboard navigation between instances ──────
  useEffect(() => {
    if (!inspectorOpen || !isMultiAgentSelected) return;
    const onKey = (e: KeyboardEvent) => {
      // Skip when a text input / textarea / contenteditable is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (!e.altKey) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setShowOverview(true);
        return;
      }

      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      e.preventDefault();
      const currentIdx = agentInstances.findIndex(
        (i) => i.instanceId === selectedInstanceId,
      );
      if (currentIdx === -1) return;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx =
        (currentIdx + dir + agentInstances.length) % agentInstances.length;
      const nextInst = agentInstances[nextIdx];
      if (nextInst) {
        selectAgent(selectedId!, { instanceId: nextInst.instanceId, tab });
        setShowOverview(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    inspectorOpen,
    isMultiAgentSelected,
    agentInstances,
    selectedInstanceId,
    selectedId,
    selectAgent,
    tab,
  ]);

  if (!inspectorOpen || !agent) return null;

  const runCount = runsQ.data?.length ?? 0;

  const isStreamActive =
    stream.phase === "starting" ||
    stream.phase === "streaming";
  const effectiveStatus = isStreamActive ? "working" : agent.status;

  const isWorking = effectiveStatus === "working" || effectiveStatus === "thinking";

  const usage = stream.usage;

  // Breadcrumb: instance index + label for the currently selected instance
  const selectedInstIdx = isMultiAgentSelected
    ? agentInstances.findIndex((i) => i.instanceId === selectedInstanceId)
    : -1;
  const selectedInst =
    selectedInstIdx >= 0 ? agentInstances[selectedInstIdx] : null;

  const handleSelectFromOverview = (instanceId: string) => {
    selectAgent(selectedId!, { instanceId, tab });
    setShowOverview(false);
  };

  return (
    <Portal>
      <div
        className="app-modal-backdrop fixed inset-0 flex items-center justify-center p-8 z-[100] bg-[radial-gradient(ellipse_1200px_700px_at_50%_35%,rgba(18,18,28,0.65),rgba(6,6,12,0.96)_80%)] after:content-[''] after:absolute after:inset-0 after:[backdrop-filter:blur(14px)_saturate(0.85)] after:[-webkit-backdrop-filter:blur(14px)_saturate(0.85)] after:bg-[rgba(10,10,18,0.58)] after:pointer-events-none"
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
                onClick={() => { changeTab(t.id); setShowOverview(false); }}
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
            <Tooltip content="Close (Esc)" side="bottom" delayMs={600}>
              <button
                className="inline-flex items-center justify-center w-8 h-8 my-auto mr-1 rounded-lg text-ao-fg-2 hover:text-ao-fg-0 hover:bg-ao-bg-3"
                aria-label="Close"
                onClick={closeInspector}
                type="button"
              >
                <Icon name="x" size={18} />
              </button>
            </Tooltip>
          </div>

          {/* ── Body row: agent strip + content ── */}
          <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          {/* Agent switcher strip - only shown when inside a project with multiple agents in multi-instance mode */}
          {isMultiInstance && rosterAgents.length > 1 && (
            <div className="ao-agent-strip flex flex-col items-center gap-1 py-[10px] w-[52px] shrink-0 border-r border-[var(--ao-line-0)] overflow-y-auto [scrollbar-width:none]">
              {rosterAgents.map((a) => {
                const inst = rosterInstances.find((r) => r.agentId === a.id);
                const isActive = a.id === selectedId;
                return (
                  <Tooltip key={a.id} content={a.name} side="right" delayMs={300}>
                    <button
                      type="button"
                      className={`relative w-[38px] h-[38px] rounded-[10px] border-2 cursor-pointer flex items-center justify-center transition-[background,border-color] duration-[120ms] shrink-0 hover:bg-[var(--ao-bg-2)] ${isActive ? "border-[var(--ao-accent)] bg-[var(--ao-bg-2)]" : "border-transparent bg-transparent"}`}
                      onClick={() => selectAgent(a.id, { tab, instanceId: inst?.instanceId ?? null })}
                    >
                      <AgentAvatar unit={a.unitChoice} size={30} label={a.name} />
                      {a.status === "working" || a.status === "thinking" ? (
                        <span className="absolute bottom-[1px] right-[1px] w-2 h-2 rounded-full border-[1.5px] border-[var(--ao-bg-1)] bg-[var(--ao-ok)] animate-[ao-pulse_1.4s_ease-in-out_infinite]" />
                      ) : null}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          )}

          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {showOverview && isMultiAgentSelected ? (
            <InstanceOverview
              agent={agent}
              instances={agentInstances}
              selectedInstanceId={selectedInstanceId}
              onSelect={handleSelectFromOverview}
              onBack={() => setShowOverview(false)}
            />
          ) : (
            <>
          {/* ── Agent header ── */}
          <div className="flex items-center gap-[14px] px-6 h-[84px] border-b border-ao-line-1 bg-gradient-to-b from-white/[0.015] to-transparent shrink-0 min-h-[var(--ao-header-h)]">
            <div className="relative shrink-0 w-[40px] h-[70px] flex items-center justify-center">
              <AgentAvatar unit={agent.unitChoice} size={40} label={agent.name} />
              <span className={`absolute right-[-2px] bottom-[-2px] w-[12px] h-[12px] rounded-full border-2 border-[var(--ao-bg-1)] ${
                isWorking
                  ? "bg-[var(--ao-ok)] shadow-[0_0_6px_var(--ao-ok)] animate-[ao-pulse_1.5s_infinite]"
                  : "bg-[var(--ao-fg-3)]"
              }`} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              {/* Breadcrumb: agent name › #N label — only when multi-instance */}
              {isMultiAgentSelected && selectedInst ? (
                <div className="flex items-center gap-[6px] text-[13px] font-semibold min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowOverview(true)}
                    className="text-ao-fg-2 hover:text-ao-fg-0 transition-colors duration-[120ms] underline-offset-2 hover:underline truncate max-w-[160px]"
                    title={`View all instances of ${agent.name}`}
                  >
                    {agent.name}
                  </button>
                  <span className="text-ao-fg-3 shrink-0" aria-hidden>›</span>
                  <span className="text-ao-fg-0 shrink-0">
                    #{selectedInstIdx + 1}
                  </span>
                  {selectedInst.label && (
                    <>
                      <span className="text-ao-fg-3 shrink-0" aria-hidden>·</span>
                      <span className="text-ao-fg-1 truncate">{selectedInst.label}</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="font-bold text-base text-ao-fg-0">{agent.name}</div>
              )}
              <div className="flex items-center gap-2 text-ao-fg-2 font-mono text-[12px]">
                <span>{agent.defaultModel ?? "default"}</span>
                <span className="w-[3px] h-[3px] bg-ao-fg-3 rounded-full" />
                <span>effort {agent.defaultEffort ?? "default"}</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Alt+← / Alt+→ navigator when multi-instance */}
              {isMultiAgentSelected && (
                <div className="flex items-center gap-[2px] mr-1">
                  <Tooltip content="Previous (Alt+←)" side="bottom">
                    <button
                      type="button"
                      aria-label="Previous instance (Alt+←)"
                      onClick={() => {
                        const ci = agentInstances.findIndex((i) => i.instanceId === selectedInstanceId);
                        const ni = (ci - 1 + agentInstances.length) % agentInstances.length;
                        const next = agentInstances[ni];
                        if (next) { selectAgent(selectedId!, { instanceId: next.instanceId, tab }); }
                      }}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-ao-fg-2 hover:text-ao-fg-0 hover:bg-ao-bg-3 border border-transparent hover:border-ao-line-1 transition-all duration-[120ms]"
                    >
                      <span className="rotate-180 inline-flex"><Icon name="chevron" size={14} /></span>
                    </button>
                  </Tooltip>
                  <span className="font-mono text-[11px] text-ao-fg-2 min-w-[32px] text-center">
                    {selectedInstIdx + 1}/{agentInstances.length}
                  </span>
                  <Tooltip content="Next (Alt+→)" side="bottom">
                    <button
                      type="button"
                      aria-label="Next instance (Alt+→)"
                      onClick={() => {
                        const ci = agentInstances.findIndex((i) => i.instanceId === selectedInstanceId);
                        const ni = (ci + 1) % agentInstances.length;
                        const next = agentInstances[ni];
                        if (next) { selectAgent(selectedId!, { instanceId: next.instanceId, tab }); }
                      }}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-ao-fg-2 hover:text-ao-fg-0 hover:bg-ao-bg-3 border border-transparent hover:border-ao-line-1 transition-all duration-[120ms]"
                    >
                      <Icon name="chevron" size={14} />
                    </button>
                  </Tooltip>
                </div>
              )}
              {tab === "conversation" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-[6px] h-7 px-[10px] rounded-lg bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 text-[13px] transition-[background,color,border-color] duration-[120ms] hover:bg-ao-bg-4 hover:text-ao-fg-0 hover:border-ao-line-2 disabled:opacity-40 disabled:cursor-default"
                  onClick={() => void handleNewConversation()}
                  disabled={addMut.isPending}
                >
                  <Icon name="plus" size={13} /> New
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
              {activeProjectId && selectedInstanceId && (
                <Tooltip content="Delete this instance" side="bottom" delayMs={400}>
                  <button
                    type="button"
                    aria-label="Delete this agent instance"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-ao-fg-3 hover:text-[var(--ao-bad)] hover:bg-[var(--ao-bad-soft)] border border-transparent hover:border-[rgba(217,83,79,0.25)] transition-all duration-[120ms] disabled:opacity-40"
                    disabled={removeMut.isPending}
                    onClick={() => {
                      removeMut.mutate(
                        { projectId: activeProjectId, instanceId: selectedInstanceId },
                        { onSuccess: closeInspector }
                      );
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </Tooltip>
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
                onActiveRunChange={setActiveRunId}
              />
            )}
            {tab === "history" && (
              <HistoryTab agentId={agent.id} />
            )}
            {tab === "memory" && <MemoryTab agentId={agent.id} discardRef={memoryDiscardRef} />}
            {tab === "settings" && (
              <SettingsTab
                agentId={agent.id}
                onAfterSave={() => {}}
                onAfterDelete={closeInspector}
              />
            )}
          </div>
            </>
          )}

          </div>{/* content-col */}
          </div>{/* body-row */}
        </div>
      </div>
    </Portal>
  );
}
