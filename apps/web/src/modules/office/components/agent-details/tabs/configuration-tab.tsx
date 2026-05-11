"use client";

import { useTranslations } from "next-intl";
import type { OfficeAgent } from "../../../hooks/use-office-agents";

export function ConfigurationTab({ agent }: { agent: OfficeAgent }) {
  const t = useTranslations();
  return (
    <div className="tab-pane" style={{ padding: 18, overflow: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ConfigCard title={t("agent_details.config_identity")}>
          <Row k={t("agent_details.config_row_name")} v={agent.name} />
          <Row k={t("agent_details.config_row_id")} v={agent.id} mono />
          <Row k={t("agent_details.config_row_description")} v={agent.description || t("agent_details.config_value_empty")} />
          <Row k={t("agent_details.config_row_room")} v={agent.room ?? t("agent_details.config_value_empty")} />
        </ConfigCard>
        <ConfigCard title={t("agent_details.config_model_runtime")}>
          <Row k={t("agent_details.config_row_model")} v={agent.defaultModel ?? t("agent_details.config_value_default")} mono />
          <Row k={t("agent_details.config_row_effort")} v={agent.defaultEffort ?? t("agent_details.config_value_default")} mono />
          <Row k={t("agent_details.config_row_permission")} v={agent.permissionMode ?? t("agent_details.config_value_ask")} mono />
        </ConfigCard>
        <ConfigCard title={t("agent_details.config_skills_card", { count: agent.skills.length })}>
          {agent.skills.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--txt-3)" }}>{t("agent_details.config_value_none")}</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {agent.skills.map((s) => (
                <span key={s} className="tag skill">#{s}</span>
              ))}
            </div>
          )}
        </ConfigCard>
        <ConfigCard title={t("agent_details.config_tools_card", { count: agent.tools.length })}>
          {agent.tools.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--txt-3)" }}>{t("agent_details.config_value_none")}</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {agent.tools.map((s) => (
                <span key={s} className="tag">{s}</span>
              ))}
            </div>
          )}
        </ConfigCard>
        <div style={{ gridColumn: "1 / -1" }}>
          <ConfigCard title={t("agent_details.config_permissions")} sub={t("agent_details.config_permissions_sub")}>
            <PermissionRow label={t("agent_details.perm_read_files")} state="allowed" />
            <PermissionRow
              label={t("agent_details.perm_edit_files")}
              state={agent.tools.includes("Edit") || agent.tools.includes("Write") ? "allowed" : "denied"}
            />
            <PermissionRow
              label={t("agent_details.perm_run_bash")}
              state={agent.tools.includes("Bash") ? "ask" : "denied"}
              note={t("agent_details.perm_note_bash")}
            />
            <PermissionRow
              label={t("agent_details.perm_open_urls")}
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
