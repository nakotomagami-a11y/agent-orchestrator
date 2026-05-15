"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  AoClose,
  AoBranch,
  AoPlus,
  AoPen,
  AoReset,
} from "@/modules/summon/components/ao-icons";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject } from "@/modules/projects/hooks/use-projects";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import "@/modules/summon/styles/agent-modal.css";

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

  const statusDotClass = effectiveStatus === "working" || effectiveStatus === "thinking" ? "ao-working" : "ao-idle";
  const ledClass = effectiveStatus === "working" || effectiveStatus === "thinking" ? "ao-working" : "ao-idle";

  const usage = stream.usage;

  return (
    <Portal>
      <div
        className="ao-backdrop fixed inset-0 flex items-center justify-center p-8 z-[100]"
        role="presentation"
        onClick={closeInspector}
      >
        <div
          ref={ref}
          className="ao-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Agent: ${agent.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Tab bar ── */}
          <div className="ao-tabbar" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`ao-tab${tab === t.id ? " ao-active" : ""}`}
                onClick={() => changeTab(t.id)}
                type="button"
              >
                <span>{t.label}</span>
                {t.id === "history" && runCount > 0 && (
                  <span className="ao-pip">{runCount}</span>
                )}
              </button>
            ))}
            <div className="ao-spacer" />
            <button
              className="ao-close"
              aria-label="Close"
              onClick={closeInspector}
              type="button"
            >
              <AoClose size={18} />
            </button>
          </div>

          {/* ── Body row: agent strip + content ── */}
          <div className="ao-body-row">
          {/* Agent switcher strip — only shown when inside a project with multiple agents */}
          {rosterAgents.length > 1 && (
            <div className="ao-agent-strip">
              {rosterAgents.map((a) => {
                const inst = rosterInstances.find((r) => r.agentId === a.id);
                const isActive = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    title={a.name}
                    className={`ao-strip-btn${isActive ? " ao-strip-active" : ""}`}
                    onClick={() => selectAgent(a.id, { tab, instanceId: inst?.instanceId ?? null })}
                  >
                    <AgentAvatar unit={a.unitChoice} size={30} label={a.name} />
                    {a.status === "working" || a.status === "thinking" ? (
                      <span className="ao-strip-dot ao-working" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="ao-content-col">
          {/* ── Agent header ── */}
          <div className="ao-agent-header">
            <div className="ao-avatar">
              <span className="text-[22px]">{agent.short[0]?.toUpperCase() ?? "?"}</span>
              <span className={`ao-status-dot ${statusDotClass}`} />
            </div>
            <div className="ao-titles">
              <div className="ao-name">{agent.name}</div>
              <div className="ao-meta">
                <span>{agent.id}</span>
                <span className="ao-dot" />
                <span>{agent.defaultModel ?? "default"}</span>
                <span className="ao-dot" />
                <span>effort {agent.defaultEffort ?? "default"}</span>
              </div>
            </div>
            <div className="ao-right">
              <span className={`ao-chip-pill ${ledClass}`}>
                <span className="ao-led" />
                {effectiveStatus}
              </span>
              {tab === "conversation" && (
                <>
                  <span className="ao-cost-chip">
                    <span className="ao-tok">{(usage.tokensIn + usage.tokensOut).toLocaleString()} tok</span>
                    <span className="ao-price">${usage.cost.toFixed(4)}</span>
                  </span>
                  <button
                    type="button"
                    className="ao-btn-mini"
                    onClick={() => setBranchSignal((n) => n + 1)}
                  >
                    <AoBranch size={13} /> Branch
                  </button>
                  <button
                    type="button"
                    className="ao-btn-mini"
                    onClick={() => setNewThreadSignal((n) => n + 1)}
                  >
                    <AoPlus size={13} /> New
                  </button>
                  <button
                    type="button"
                    className="ao-btn-mini ao-ghost"
                    aria-label="Edit agent"
                    onClick={() => changeTab("settings")}
                  >
                    <AoPen size={13} />
                  </button>
                </>
              )}
              {tab === "configuration" && (
                <button
                  type="button"
                  className="ao-btn-mini"
                  onClick={() => changeTab("settings")}
                >
                  <AoPen size={13} /> Edit
                </button>
              )}
              {tab === "memory" && (
                <button
                  type="button"
                  className="ao-btn-mini"
                  onClick={() => {/* discard handled by MemoryTab */ }}
                >
                  <AoReset size={13} /> Discard
                </button>
              )}
              {tab === "settings" && (
                <button
                  type="button"
                  className="ao-btn-mini"
                  onClick={() => {/* reset handled by SettingsTab */ }}
                >
                  <AoReset size={13} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="ao-modal-body">
            {tab === "conversation" && (
              <ChatPanel
                agent={agent}
                projectId={activeProjectId ?? undefined}
                instanceId={selectedInstanceId ?? undefined}
                onClose={closeInspector}
                onEdit={() => changeTab("settings")}
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
            {tab === "memory" && <MemoryTab agentId={agent.id} />}
            {tab === "settings" && (
              <SettingsTab
                agentId={agent.id}
                onAfterSave={() => changeTab("configuration")}
                onAfterDelete={closeInspector}
              />
            )}
          </div>
          </div>{/* ao-content-col */}
          </div>{/* ao-body-row */}
        </div>
      </div>
    </Portal>
  );
}
