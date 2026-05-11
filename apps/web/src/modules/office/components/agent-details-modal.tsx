"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ModalShell } from "@/components/ui/modal-shell";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/ui/icon";
import { useOfficeAgents, type OfficeAgent } from "../hooks/use-office-agents";
import { useOfficeStore } from "../hooks/use-office-store";
import { ChatPanel } from "@/modules/summon/components/chat-panel";
import { useAgent, useAgentBody, useAgentMemory, useWriteAgentMemory } from "@/modules/agents/hooks/use-agents";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";

type Tab = "conversation" | "configuration" | "history" | "memory" | "prompt";

/**
 * Global agent inspector — mounted once at the app shell. Tabs are modelled
 * after the v3 design: Conversation (chat surface), Configuration (read-only
 * identity + runtime + permissions), History (recent runs), Memory (editable
 * facts file), System Prompt (markdown body).
 */
export function AgentDetailsModal() {
  const selectedId = useOfficeStore((s) => s.selectedId);
  const inspectorOpen = useOfficeStore((s) => s.inspectorOpen);
  const closeInspector = useOfficeStore((s) => s.closeInspector);
  const { agents } = useOfficeAgents();
  const agent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;
  const [tab, setTab] = useState<Tab>("conversation");

  useEffect(() => {
    if (inspectorOpen) setTab("conversation");
  }, [inspectorOpen, selectedId]);

  const runsQ = useRuns({ agentId: agent?.id, limit: 30 });
  const tabItems = [
    { value: "conversation" as const, label: "Conversation" },
    { value: "configuration" as const, label: "Configuration" },
    {
      value: "history" as const,
      label: "History",
      count: runsQ.data?.length,
    },
    { value: "memory" as const, label: "Memory" },
    { value: "prompt" as const, label: "System Prompt" },
  ];

  return (
    <ModalShell
      open={inspectorOpen && !!agent}
      onClose={closeInspector}
      size="lg"
      bareContent
    >
      {agent ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 0" }}>
            <Tabs items={tabItems} value={tab} onChange={setTab} ariaLabel="Agent sections" />
            <button
              type="button"
              onClick={closeInspector}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "none",
                width: 28,
                height: 28,
                borderRadius: 999,
                cursor: "pointer",
                color: "var(--txt-3)",
                marginRight: 8,
              }}
            >
              <Icon name="x" />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {tab === "conversation" ? (
              <ChatPanel agent={agent} onClose={closeInspector} onEdit={() => setTab("prompt")} />
            ) : null}
            {tab === "configuration" ? <ConfigurationTab agent={agent} /> : null}
            {tab === "history" ? <HistoryTab agentId={agent.id} /> : null}
            {tab === "memory" ? <MemoryTab agentId={agent.id} /> : null}
            {tab === "prompt" ? <SystemPromptTab agentId={agent.id} /> : null}
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

// ── Configuration ─────────────────────────────────────────────────────────
function ConfigurationTab({ agent }: { agent: OfficeAgent }) {
  return (
    <div className="tab-pane" style={{ padding: 18, overflow: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ConfigCard title="Identity">
          <Row k="Name" v={agent.name} />
          <Row k="ID" v={agent.id} mono />
          <Row k="Description" v={agent.description || "—"} />
          <Row k="Room" v={agent.room ?? "—"} />
        </ConfigCard>
        <ConfigCard title="Model & runtime">
          <Row k="Model" v={agent.defaultModel ?? "default"} mono />
          <Row k="Effort" v={agent.defaultEffort ?? "default"} mono />
          <Row k="Permission" v={agent.permissionMode ?? "ask"} mono />
        </ConfigCard>
        <ConfigCard title={`Skills (${agent.skills.length})`}>
          {agent.skills.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--txt-3)" }}>none</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {agent.skills.map((s) => (
                <span key={s} className="tag skill">#{s}</span>
              ))}
            </div>
          )}
        </ConfigCard>
        <ConfigCard title={`Tools allowed (${agent.tools.length})`}>
          {agent.tools.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--txt-3)" }}>none</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {agent.tools.map((s) => (
                <span key={s} className="tag">{s}</span>
              ))}
            </div>
          )}
        </ConfigCard>
        <div style={{ gridColumn: "1 / -1" }}>
          <ConfigCard title="Permissions" sub="workspace policy applies">
            <PermissionRow label="Read repository files" state="allowed" />
            <PermissionRow
              label="Edit files"
              state={agent.tools.includes("Edit") || agent.tools.includes("Write") ? "allowed" : "denied"}
            />
            <PermissionRow
              label="Run bash commands"
              state={agent.tools.includes("Bash") ? "ask" : "denied"}
              note="will prompt for destructive commands"
            />
            <PermissionRow
              label="Open URLs (web)"
              state={
                agent.tools.includes("WebFetch") || agent.tools.includes("WebSearch")
                  ? "allowed"
                  : "denied"
              }
            />
          </ConfigCard>
        </div>
      </div>
    </div>
  );
}

function ConfigCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-h">
        <span className="title">{title}</span>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
      <div style={{ padding: 14, fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, padding: "4px 0" }}>
      <div style={{ color: "var(--txt-3)", fontSize: 12 }}>{k}</div>
      <div style={{ fontFamily: mono ? "var(--font-mono)" : "inherit", fontSize: mono ? 12 : 13 }}>
        {v}
      </div>
    </div>
  );
}

type PermissionState = "allowed" | "denied" | "ask" | "restricted";

function PermissionRow({
  label,
  state,
  note,
}: {
  label: string;
  state: PermissionState;
  note?: string;
}) {
  const colors: Record<PermissionState, string> = {
    allowed: "var(--done)",
    denied: "var(--error)",
    ask: "var(--queued)",
    restricted: "var(--thinking)",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px dashed var(--line)",
        gap: 12,
      }}
    >
      <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
      {note ? (
        <span
          style={{
            fontSize: 11,
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {note}
        </span>
      ) : null}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 999,
          color: colors[state],
          background: "var(--bg-2)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        {state}
      </span>
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────
function HistoryTab({ agentId }: { agentId: string }) {
  const runsQ = useRuns({ agentId, limit: 50 });
  const runs = runsQ.data ?? [];
  const totalCost = runs.reduce((s, r) => s + (r.cost || 0), 0);

  if (runsQ.isLoading) {
    return (
      <div className="tab-pane" style={{ padding: 18 }}>
        <Skeleton width="100%" height={180} />
      </div>
    );
  }

  return (
    <div className="tab-pane" style={{ padding: 18, overflow: "auto" }}>
      <div className="card">
        <div className="card-h">
          <span className="title">History</span>
          <span className="sub">
            {runs.length} run{runs.length === 1 ? "" : "s"} · ${totalCost.toFixed(3)} total
          </span>
        </div>
        {runs.length === 0 ? (
          <div style={{ padding: 18, fontSize: 13, color: "var(--txt-3)" }}>
            No runs yet — start a conversation in the Conversation tab.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-2)", color: "var(--txt-3)" }}>
                <th style={TH}>Run</th>
                <th style={TH}>Prompt</th>
                <th style={TH}>When</th>
                <th style={TH}>Duration</th>
                <th style={TH}>Tokens</th>
                <th style={TH}>Cost</th>
                <th style={TH}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const outcome = r.status === "done" ? "completed" : r.status;
                const ok = outcome === "completed";
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={TD_MONO}>{r.id.slice(0, 8)}</td>
                    <td style={TD}>
                      <span title={r.prompt}>{trim(r.prompt, 56)}</span>
                    </td>
                    <td style={TD_MONO}>{relTime(r.ts)}</td>
                    <td style={TD_MONO}>{(r.durMs / 1000).toFixed(1)}s</td>
                    <td style={TD_MONO}>{(r.tokensIn + r.tokensOut).toLocaleString()}</td>
                    <td style={TD_MONO}>${r.cost.toFixed(3)}</td>
                    <td style={TD}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: ok
                            ? "rgba(14,132,32,0.10)"
                            : "rgba(199,22,43,0.10)",
                          color: ok ? "var(--done)" : "var(--error)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {outcome}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 600,
};
const TD: React.CSSProperties = { padding: "10px 14px", fontSize: 13 };
const TD_MONO: React.CSSProperties = { ...TD, fontFamily: "var(--font-mono)", fontSize: 12 };

function trim(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// ── Memory ────────────────────────────────────────────────────────────────
function MemoryTab({ agentId }: { agentId: string }) {
  const memQ = useAgentMemory(agentId);
  const writeMem = useWriteAgentMemory();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);

  if (memQ.isLoading) {
    return (
      <div className="tab-pane" style={{ padding: 18 }}>
        <Skeleton width="100%" height={180} />
      </div>
    );
  }

  const value = draft ?? memQ.data ?? "";
  const dirty = draft !== null && draft !== (memQ.data ?? "");

  const save = () => {
    writeMem.mutate(
      { id: agentId, content: draft ?? "" },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: queryKeys.agents.memory(agentId) });
          setDraft(null);
        },
      },
    );
  };

  return (
    <div className="tab-pane" style={{ padding: 18, overflow: "auto" }}>
      <div className="card">
        <div className="card-h">
          <span className="title">Memory</span>
          <span className="sub">facts this agent carries into every conversation</span>
          <div style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className="btn sm primary"
              disabled={!dirty || writeMem.isPending}
              onClick={save}
            >
              {writeMem.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <Textarea
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            placeholder={"preferences:\n  prefers pnpm over npm\n\nteam_voice:\n  conventional commits"}
          />
        </div>
      </div>
    </div>
  );
}

// ── System Prompt ─────────────────────────────────────────────────────────
function SystemPromptTab({ agentId }: { agentId: string }) {
  const agentQ = useAgent(agentId);
  const bodyQ = useAgentBody(agentId);
  if (agentQ.isLoading || bodyQ.isLoading) {
    return (
      <div className="tab-pane" style={{ padding: 18 }}>
        <Skeleton width="100%" height={240} />
      </div>
    );
  }
  const body = bodyQ.data ?? "";
  return (
    <div className="tab-pane" style={{ padding: 18, overflow: "auto" }}>
      <div className="card">
        <div className="card-h">
          <span className="title">System Prompt</span>
          <span className="sub">{body.split("\n").length} lines · markdown body</span>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 18,
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--txt)",
            background: "var(--bg-1)",
            whiteSpace: "pre-wrap",
            borderRadius: "0 0 14px 14px",
            overflow: "auto",
          }}
        >
          {body || "(empty body)"}
        </pre>
      </div>
    </div>
  );
}
