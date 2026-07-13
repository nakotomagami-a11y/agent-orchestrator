"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/domain/hooks/api";
import { queryKeys } from "@agent-office/domain/hooks/query-keys";
import { API_ROUTES } from "@agent-office/domain/config/routes";
import type { SavedPrompt } from "@agent-office/domain/types";

export function useSavedPrompts(opts?: { category?: string; q?: string }) {
  const params = new URLSearchParams();
  if (opts?.category) params.set("category", opts.category);
  if (opts?.q) params.set("q", opts.q);
  const qs = params.toString();
  const url = qs ? `${API_ROUTES.savedPrompts}?${qs}` : API_ROUTES.savedPrompts;
  return useQuery({
    queryKey: queryKeys.prompts.saved(opts),
    queryFn: () => apiFetch<SavedPrompt[]>(url),
  });
}

export function useCreateSavedPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; body: string; category?: string }) =>
      apiFetch<SavedPrompt>(API_ROUTES.savedPrompts, { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-prompts"] });
    },
  });
}

export function useDeleteSavedPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(API_ROUTES.savedPromptById(id), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-prompts"] });
    },
  });
}

export function useRecordSavedPromptUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(API_ROUTES.savedPromptUse(id), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-prompts"] });
    },
  });
}

export function useBulkInsertSavedPrompts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prompts: Array<{ title: string; body: string; category: string }>) =>
      apiFetch<{ inserted: number }>(API_ROUTES.savedPromptsBulk, {
        method: "POST",
        body: { prompts },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-prompts"] });
    },
  });
}
