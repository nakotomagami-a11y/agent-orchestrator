"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ModalShell } from "@/components/ui/modal-shell";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { Icon } from "@/components/ui/icon";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useOfficeAgents, type OfficeAgent } from "../hooks/use-office-agents";
import { useOfficeStore } from "../hooks/use-office-store";
import { ChatPanel } from "@/modules/summon/components/chat-panel";
import { AgentForm } from "@/modules/agents/components/agent-form";
import { useAgent, useAgentBody } from "@/modules/agents/hooks/use-agents";
import { fromApi } from "@/modules/agents/utils/agent-form";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";

type Tab = "conversation" | "details" | "settings";

const TAB_ITEMS = [
  { value: "conversation" as const, label: "Conversation" },
  { value: "details" as const, label: "Details" },
  { value: "settings" as const, label: "Settings" },
];

/**
 * Global agent inspector — mounted once at the app shell. Opens whenever
 * `useOfficeStore.inspectorOpen` flips true (sidebar click, desk click).
 * Tabs let you talk to the agent, inspect its current state, or edit its
 * markdown definition without leaving the office.
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

  return (
    <ModalShell
      open={inspectorOpen && !!agent}
      onClose={closeInspector}
      size="lg"
      bareContent
    >
      {agent ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Header agent={agent} onClose={closeInspector} />
          <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} ariaLabel="Agent sections" />
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {tab === "conversation" ? (
              <ConversationTab agent={agent} onClose={closeInspector} />
            ) : null}
            {tab === "details" ? <DetailsTab agent={agent} /> : null}
            {tab === "settings" ? (
              <SettingsTab agentId={agent.id} onAfterSave={() => setTab("details")} onAfterDelete={closeInspector} />
            ) : null}
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

function Header({ agent, onClose }: { agent: OfficeAgent; onClose: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ width: 40, height: 40 }}>
        <PixelSprite
          agent={agent}
          size={40}
          animate={false}
          action={agent.status === "working" ? "typing" : "idle"}
        />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{agent.name}</div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--txt-3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {agent.id} ·{" "}
          <span
            style={{
              color:
                agent.status === "error"
                  ? "var(--error)"
                  : agent.status === "working"
                    ? "var(--acc)"
                    : "var(--txt-3)",
            }}
          >
            {agent.status}
            {agent.task ? ` — ${agent.task}` : ""}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          background: "transparent",
          border: "none",
          width: 28,
          height: 28,
          borderRadius: 999,
          cursor: "pointer",
          color: "var(--txt-3)",
        }}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}

function ConversationTab({ agent, onClose }: { agent: OfficeAgent; onClose: () => void }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <ChatPanel agent={agent} onClose={onClose} />
    </div>
  );
}

function DetailsTab({ agent }: { agent: OfficeAgent }) {
  return (
    <div style={{ padding: 18, overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <Section title="Description">
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-2)", lineHeight: 1.5 }}>
          {agent.description || "No description set."}
        </p>
      </Section>

      <Section title="Model & permissions">
        <KvGrid
          rows={[
            ["model", agent.defaultModel ?? "default"],
            ["effort", agent.defaultEffort ?? "default"],
            ["permission", agent.permissionMode ?? "ask"],
            ["room", agent.room ?? "—"],
            ["tools", `${agent.tools.length} allowed`],
          ]}
        />
      </Section>

      {agent.skills.length > 0 ? (
        <Section title="Skills">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {agent.skills.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "var(--bg-2)",
                  color: "var(--txt-2)",
                  border: "1px solid var(--line)",
                }}
              >
                #{s}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {agent.tools.length > 0 ? (
        <Section title="Tools allowed">
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--txt-2)",
              lineHeight: 1.6,
            }}
          >
            {agent.tools.join(", ")}
          </div>
        </Section>
      ) : null}

      <Section title="Current task">
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-2)" }}>
          {agent.task ?? "Idle — ready when you are."}
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "var(--txt-3)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KvGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: "6px 12px",
        fontSize: 12,
      }}
    >
      {rows.map(([k, v]) => (
        <span key={k} style={{ display: "contents" }}>
          <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            {k}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{v}</span>
        </span>
      ))}
    </div>
  );
}

function SettingsTab({
  agentId,
  onAfterSave,
  onAfterDelete,
}: {
  agentId: string;
  onAfterSave: () => void;
  onAfterDelete: () => void;
}) {
  const agentQ = useAgent(agentId);
  const bodyQ = useAgentBody(agentId);
  const qc = useQueryClient();

  if (agentQ.isLoading || bodyQ.isLoading) {
    return (
      <div style={{ padding: 18 }}>
        <Skeleton width="100%" height={200} />
      </div>
    );
  }
  if (!agentQ.data) {
    return (
      <div style={{ padding: 18, fontSize: 13, color: "var(--txt-3)" }}>
        Couldn't load agent definition.
      </div>
    );
  }

  const initial = fromApi(agentQ.data, bodyQ.data ?? "");

  return (
    <div style={{ padding: 18, overflow: "auto" }}>
      <AgentForm
        mode="edit"
        initial={initial}
        hideCancel
        onSaved={() => {
          qc.invalidateQueries({ queryKey: queryKeys.agents.all });
          onAfterSave();
        }}
        onDeleted={onAfterDelete}
      />
    </div>
  );
}
