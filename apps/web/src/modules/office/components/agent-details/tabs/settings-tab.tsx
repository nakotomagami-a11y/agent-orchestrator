"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent, useAgentBody } from "@/modules/agents/hooks/use-agents";
import { AgentForm } from "@/modules/agents/components/agent-form";
import { BodyHistoryPanel } from "@/modules/agents/components/body-history-panel";
import { fromApi } from "@/modules/agents/utils/agent-form";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";

type SubTab = "form" | "history";

export function SettingsTab({
  agentId,
  onAfterSave,
  onAfterDelete,
}: {
  agentId: string;
  onAfterSave: () => void;
  onAfterDelete: () => void;
}) {
  const t = useTranslations();
  const agentQ = useAgent(agentId);
  const bodyQ = useAgentBody(agentId);
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>("form");
  // Incrementing this key forces AgentForm to remount with fresh initial values
  const [formKey, setFormKey] = useState(0);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);

  const handleRestore = (body: string) => {
    setBodyOverride(body);
    setFormKey((k) => k + 1);
    setSubTab("form");
  };

  if (agentQ.isLoading || bodyQ.isLoading) {
    return (
      <div className="tab-pane" style={{ padding: 18 }}>
        <Skeleton width="100%" height={240} />
      </div>
    );
  }
  if (!agentQ.data) {
    return (
      <div className="tab-pane" style={{ padding: 18, fontSize: 13, color: "var(--txt-3)" }}>
        {t("agent_details.settings_load_failed")}
      </div>
    );
  }

  const baseBody = bodyOverride ?? bodyQ.data ?? "";
  const initial = fromApi(agentQ.data, baseBody);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Sub-tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-1)",
          padding: "0 18px",
          flexShrink: 0,
        }}
        role="tablist"
        aria-label={t("agent_form.history_tab")}
      >
        <SubTabButton
          active={subTab === "form"}
          onClick={() => setSubTab("form")}
          id="settings-tab-form"
        >
          {t("agent_details.tab_settings")}
        </SubTabButton>
        <SubTabButton
          active={subTab === "history"}
          onClick={() => setSubTab("history")}
          id="settings-tab-history"
        >
          {t("agent_form.history_tab")}
        </SubTabButton>
      </div>

      {subTab === "form" ? (
        <div className="tab-pane" style={{ padding: 18, overflow: "auto", flex: 1 }}>
          <AgentForm
            key={formKey}
            mode="edit"
            initial={initial}
            hideCancel
            onSaved={() => {
              setBodyOverride(null);
              qc.invalidateQueries({ queryKey: queryKeys.agents.all });
              qc.invalidateQueries({ queryKey: queryKeys.agents.body(agentId) });
              qc.invalidateQueries({ queryKey: ["agents", "body-history", agentId] });
              onAfterSave();
            }}
            onDeleted={onAfterDelete}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          <BodyHistoryPanel agentId={agentId} onRestore={handleRestore} />
        </div>
      )}
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  id,
  children,
}: {
  active: boolean;
  onClick: () => void;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      id={id}
      type="button"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={`chat-tab${active ? " on" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
