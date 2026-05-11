"use client";

import type { OfficeAgent } from "../../../hooks/use-office-agents";

export function ConfigurationTab({ agent }: { agent: OfficeAgent }) {
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
