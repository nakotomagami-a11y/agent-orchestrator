import type { AgentInstance } from "@agent-office/domain/types";

export function buildInstanceIndexMap(
  isMultiInstance: boolean,
  rosterInstances: AgentInstance[],
): Map<string, number> {
  const m = new Map<string, number>();
  if (isMultiInstance && rosterInstances.length > 0) {
    const seenByAgent = new Map<string, number>();
    for (const inst of rosterInstances) {
      const prev = seenByAgent.get(inst.agentId) ?? 0;
      const idx = prev + 1;
      seenByAgent.set(inst.agentId, idx);
      m.set(inst.instanceId, idx);
    }
  }
  return m;
}
