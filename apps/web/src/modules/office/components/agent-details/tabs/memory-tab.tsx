"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { MemoryEditor } from "@/modules/memory/components/memory-editor";
import { useAgentMemory, useWriteAgentMemory } from "@/modules/agents/hooks/use-agents";

export function MemoryTab({ agentId }: { agentId: string }) {
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
          <span className="title">Memory</span>
          <span className="sub">facts this agent carries into every conversation</span>
        </div>
        <div style={{ padding: 14 }}>
          <MemoryEditor
            value={memQ.data ?? ""}
            onSave={(content) => writeMem.mutateAsync({ id: agentId, content })}
            rows={16}
            placeholder={"preferences:\n  prefers pnpm over npm\n\nteam_voice:\n  conventional commits"}
          />
        </div>
      </div>
    </div>
  );
}
