"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import type { ApiAgent, PersistedRun } from "@agent-office/shared/types";
import { POLL } from "@/lib/polling";
import { agentHash, paletteForAgent, shortName } from "../utils/sprite-palette";
import { deriveDeskCoords, type DeskCoords } from "../utils/desk-layout";
import { statusFromRuns, type AgentStatusInfo } from "../utils/derive-status";

export interface OfficeAgent extends ApiAgent {
  id: string;
  short: string;
  desk: DeskCoords;
  sprite: ReturnType<typeof paletteForAgent>["sprite"];
  status: AgentStatusInfo["status"];
  task?: string;
  taskKind?: string;
}

interface OfficeAgentsResult {
  agents: OfficeAgent[];
  workingCount: number;
  idleCount: number;
  errorCount: number;
  spendToday: number;
}

export function useOfficeAgents(): OfficeAgentsResult & { isLoading: boolean } {
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(),
    queryFn: () => apiFetch<ApiAgent[]>(API_ROUTES.agents),
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.runs.list({ limit: 50 }),
    queryFn: () => apiFetch<PersistedRun[]>(`${API_ROUTES.runs}?limit=50`),
    refetchInterval: POLL.RUNS,
  });

  const agents = (agentsQuery.data ?? []).map<OfficeAgent>((a, idx) => {
    const hash = agentHash(a.name);
    const status = statusFromRuns(a.name, runsQuery.data ?? []);
    return {
      ...a,
      id: a.name,
      short: shortName(a.name),
      desk: deriveDeskCoords(idx, hash),
      sprite: paletteForAgent(a.name).sprite,
      status: status.status,
      task: status.task,
      taskKind: status.taskKind,
    };
  });

  const workingCount = agents.filter((a) => a.status === "working" || a.status === "thinking").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const errorCount = agents.filter((a) => a.status === "error").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const spendToday = (runsQuery.data ?? [])
    .filter((r) => r.ts >= today.getTime())
    .reduce((sum, r) => sum + (r.cost || 0), 0);

  return {
    agents,
    workingCount,
    idleCount,
    errorCount,
    spendToday,
    isLoading: agentsQuery.isLoading,
  };
}
