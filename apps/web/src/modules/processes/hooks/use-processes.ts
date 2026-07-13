"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/domain/hooks/api";
import type { ProcessInfo } from "@/app/api/processes/route";

export type { ProcessInfo };

const PROCESSES_KEY = ["processes"] as const;

export function useProcesses(enabled: boolean) {
  return useQuery({
    queryKey: PROCESSES_KEY,
    queryFn: () => apiFetch<ProcessInfo[]>("/api/processes"),
    refetchInterval: enabled ? 5000 : false,
    enabled,
  });
}

export function useInvalidateProcesses() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: PROCESSES_KEY });
}
