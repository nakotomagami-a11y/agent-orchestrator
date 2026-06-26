"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import type { AgentInstance, Project, ProjectMeta, ProjectSummary } from "@agent-office/shared/types";
import { getGitStatus } from "@/lib/api/dev-server";
import type { GitStatus } from "@/app/api/projects/[id]/git-status/route";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => apiFetch<ProjectSummary[]>(API_ROUTES.projects),
    refetchInterval: 10_000,
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id ?? "__none"),
    queryFn: () => apiFetch<Project>(API_ROUTES.project(id!)),
    enabled: !!id,
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { meta?: Partial<ProjectMeta>; memory?: string } }) =>
      apiFetch<Project>(API_ROUTES.project(id), { method: "PUT", body: patch }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(vars.id) });
    },
  });
}

export function useAddInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, agentId, init, force }: { projectId: string; agentId: string; init?: Partial<AgentInstance>; force?: boolean }) =>
      apiFetch<{ project: Project; instance: AgentInstance }>(API_ROUTES.projectRoster(projectId), {
        method: "POST",
        body: { agentId, init, force },
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(vars.projectId) });
    },
  });
}

export function useUpdateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      instanceId,
      patch,
    }: {
      projectId: string;
      instanceId: string;
      patch: { label?: string; model?: string; effort?: string; permissionMode?: string; room?: string };
    }) =>
      apiFetch<AgentInstance>(API_ROUTES.projectRosterItem(projectId, instanceId), {
        method: "PATCH",
        body: patch,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(vars.projectId) });
    },
  });
}

export function useRemoveInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, instanceId }: { projectId: string; instanceId: string }) =>
      apiFetch<Project>(API_ROUTES.projectRosterItem(projectId, instanceId), { method: "DELETE" }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(vars.projectId) });
    },
  });
}

export function useGitStatus(projectId: string | null, hasCwd: boolean) {
  return useQuery<GitStatus>({
    queryKey: ["git-status", projectId],
    queryFn: () => getGitStatus(projectId!),
    enabled: !!projectId && hasCwd,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      apiFetch<Project>(API_ROUTES.projects, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

