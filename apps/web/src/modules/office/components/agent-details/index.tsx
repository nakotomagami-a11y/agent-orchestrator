"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ModalShell } from "@/components/ui/modal-shell";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icon";
import { useOfficeAgents } from "../../hooks/use-office-agents";
import { useOfficeStore, type AgentTab } from "../../hooks/use-office-store";
import { ChatPanel } from "@/modules/summon/components/chat-panel";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { ConfigurationTab } from "./tabs/configuration-tab";
import { HistoryTab } from "./tabs/history-tab";
import { MemoryTab } from "./tabs/memory-tab";
import { SettingsTab } from "./tabs/settings-tab";

type Tab = AgentTab;

/**
 * Global agent inspector — mounted once at the app shell. Tabs are modelled
 * after the v3 design: Conversation (chat surface), Configuration (read-only
 * identity + runtime + permissions), History (recent runs), Memory (editable
 * facts file), System Prompt (markdown body).
 */
export function AgentDetailsModal() {
  const t = useTranslations();
  const selectedId = useOfficeStore((s) => s.selectedId);
  const selectedInstanceId = useOfficeStore((s) => s.selectedInstanceId);
  const inspectorOpen = useOfficeStore((s) => s.inspectorOpen);
  const closeInspector = useOfficeStore((s) => s.closeInspector);
  const consumePendingTab = useOfficeStore((s) => s.consumePendingTab);
  const { agents } = useOfficeAgents();
  const agent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;
  const [tab, setTab] = useState<Tab>("conversation");

  useEffect(() => {
    if (inspectorOpen) {
      const pending = consumePendingTab();
      setTab(pending ?? "conversation");
    }
  }, [inspectorOpen, selectedId, consumePendingTab]);

  const runsQ = useRuns({ agentId: agent?.id, limit: 30 });
  const tabItems = [
    { value: "conversation" as const, label: t("agent_details.tab_conversation") },
    { value: "configuration" as const, label: t("agent_details.tab_configuration") },
    {
      value: "history" as const,
      label: t("agent_details.tab_history"),
      count: runsQ.data?.length,
    },
    { value: "memory" as const, label: t("agent_details.tab_memory") },
    { value: "settings" as const, label: t("agent_details.tab_settings") },
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
            <Tabs items={tabItems} value={tab} onChange={setTab} ariaLabel={t("agent_details.tabs_aria")} />
            <button
              type="button"
              onClick={closeInspector}
              aria-label={t("agent_details.modal_close_aria")}
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
              <ChatPanel
                agent={agent}
                instanceId={selectedInstanceId ?? undefined}
                onClose={closeInspector}
                onEdit={() => setTab("settings")}
              />
            ) : null}
            {tab === "configuration" ? <ConfigurationTab agent={agent} /> : null}
            {tab === "history" ? <HistoryTab agentId={agent.id} /> : null}
            {tab === "memory" ? <MemoryTab agentId={agent.id} /> : null}
            {tab === "settings" ? (
              <SettingsTab
                agentId={agent.id}
                onAfterSave={() => setTab("configuration")}
                onAfterDelete={closeInspector}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}
