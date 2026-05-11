"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent, useAgentBody } from "@/modules/agents/hooks/use-agents";
import { AgentForm } from "@/modules/agents/components/agent-form";
import { fromApi } from "@/modules/agents/utils/agent-form";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";

export function SettingsTab({
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
      <div className="tab-pane" style={{ padding: 18 }}>
        <Skeleton width="100%" height={240} />
      </div>
    );
  }
  if (!agentQ.data) {
    return (
      <div className="tab-pane" style={{ padding: 18, fontSize: 13, color: "var(--txt-3)" }}>
        Couldn&apos;t load agent definition.
      </div>
    );
  }

  const initial = fromApi(agentQ.data, bodyQ.data ?? "");

  return (
    <div className="tab-pane" style={{ padding: 18, overflow: "auto" }}>
      <AgentForm
        mode="edit"
        initial={initial}
        hideCancel
        onSaved={() => {
          qc.invalidateQueries({ queryKey: queryKeys.agents.all });
          qc.invalidateQueries({ queryKey: queryKeys.agents.body(agentId) });
          onAfterSave();
        }}
        onDeleted={onAfterDelete}
      />
    </div>
  );
}
