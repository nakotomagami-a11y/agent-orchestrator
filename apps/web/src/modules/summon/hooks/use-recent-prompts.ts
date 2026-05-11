"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { API_ROUTES } from "@agent-office/shared/config/routes";

export function useRecentPrompts(agentId: string | null) {
  return useQuery({
    queryKey: agentId ? queryKeys.agents.prompts(agentId) : ["__noop"],
    queryFn: () => apiFetch<string[]>(API_ROUTES.agentPrompts(agentId!)),
    enabled: !!agentId,
    staleTime: 30_000,
  });
}
