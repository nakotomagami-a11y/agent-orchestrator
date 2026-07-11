"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { POLL } from "@/lib/polling";
import type { InstalledSkill, RegistrySkill, SkillUpdate } from "@agent-office/shared/types";

export interface SkillManifestEntry {
  slug: string;
  source_id?: string;
  source_path?: string;
  symlink_status?: string;
  target?: string;
  category?: string;
  workflow_depth?: string;
  token_cost_est?: number;
  impact_tier?: string;
  impact_emoji?: string;
  description?: string;
}

export interface SkillManifest {
  generated_at?: string;
  generator?: string;
  cost_indicator_scale?: Record<string, string>;
  workflow_depth_legend?: Record<string, string>;
  sources?: Record<string, unknown>;
  skills: SkillManifestEntry[];
}

export interface SkillCompatibility {
  conflicts?: unknown;
  synergies?: unknown;
  ab_test_pairs?: unknown;
  [k: string]: unknown;
}

export function useRegistry(refresh = false) {
  return useQuery({
    queryKey: queryKeys.skills.registry(),
    queryFn: () =>
      apiFetch<RegistrySkill[]>(`${API_ROUTES.skillsRegistry}${refresh ? "?refresh=1" : ""}`),
    staleTime: 60 * 60_000,
  });
}

export function useInstalledSkills() {
  return useQuery({
    queryKey: queryKeys.skills.installed(),
    queryFn: () => apiFetch<InstalledSkill[]>(API_ROUTES.skillsInstalled),
  });
}


export interface InstallSkillInput {
  source: string;
  ref: string;
  path: string;
  name: string;
}

export function useInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InstallSkillInput) =>
      apiFetch<{ ok: boolean }>(API_ROUTES.skillsInstall, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.skills.all });
    },
  });
}

export function useSkillManifest() {
  return useQuery({
    queryKey: queryKeys.skills.manifest(),
    queryFn: () => apiFetch<SkillManifest>(API_ROUTES.skillsManifest),
    staleTime: 60 * 60_000,
  });
}

export function useSkillCompatibility() {
  return useQuery({
    queryKey: queryKeys.skills.compatibility(),
    queryFn: () => apiFetch<SkillCompatibility>(API_ROUTES.skillsCompatibility),
    staleTime: 60 * 60_000,
  });
}

export function useUninstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ removed: boolean }>(API_ROUTES.skill(name), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.skills.all });
    },
  });
}
