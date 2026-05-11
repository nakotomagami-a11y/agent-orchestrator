"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { MemoryEditor } from "@/modules/memory/components/memory-editor";
import { useAgentMemory, useWriteAgentMemory } from "@/modules/agents/hooks/use-agents";

export function MemoryTab({ agentId }: { agentId: string }) {
  const t = useTranslations();
  const memQ = useAgentMemory(agentId);
  const writeMem = useWriteAgentMemory();

  if (memQ.isLoading) {
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
          <span className="title">{t("agent_details.memory_card_title")}</span>
          <span className="sub">{t("agent_details.memory_card_sub")}</span>
        </div>
        <div style={{ padding: 14 }}>
          <MemoryEditor
            value={memQ.data ?? ""}
            onSave={(content) => writeMem.mutateAsync({ id: agentId, content })}
            rows={16}
            placeholder={t("agent_details.memory_tab_placeholder")}
          />
        </div>
      </div>
    </div>
  );
}
