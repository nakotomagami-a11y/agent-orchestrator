/**
 * Centralized React Query keys. Every useQuery in the app references these.
 *
 * Mirrors `packages/shared/src/hooks/query-keys.ts` rule from the architecture.
 */

type RunsFilter = { agentId?: string; projectId?: string; instanceId?: string; limit?: number };

// Strip undefined values + sort keys so `{}`, `{agentId: undefined}`, and
// `{limit: 100, agentId: 'x'}` vs `{agentId: 'x', limit: 100}` hash equally
// in TanStack Query's structural keying.
function normalizeRunsFilter(filters: RunsFilter | undefined): Record<string, unknown> {
  if (!filters) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(filters).sort() as Array<keyof RunsFilter>) {
    const value = filters[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export const queryKeys = {
  health: ["health"] as const,
  templates: ["templates"] as const,

  agents: {
    all: ["agents"] as const,
    list: () => [...queryKeys.agents.all, "list"] as const,
    detail: (id: string) => [...queryKeys.agents.all, "detail", id] as const,
    body: (id: string) => [...queryKeys.agents.all, "body", id] as const,
    memory: (id: string) => [...queryKeys.agents.all, "memory", id] as const,
    prompts: (id: string) => [...queryKeys.agents.all, "prompts", id] as const,
    uploads: (id: string) => [...queryKeys.agents.all, "uploads", id] as const,
  },

  memory: {
    global: ["memory", "global"] as const,
  },

  projects: {
    all: ["projects"] as const,
    list: () => [...queryKeys.projects.all, "list"] as const,
    detail: (id: string) => [...queryKeys.projects.all, "detail", id] as const,
    memory: (id: string) => [...queryKeys.projects.all, "memory", id] as const,
    uploads: (id: string) => [...queryKeys.projects.all, "uploads", id] as const,
  },

  skills: {
    all: ["skills"] as const,
    registry: () => [...queryKeys.skills.all, "registry"] as const,
    installed: () => [...queryKeys.skills.all, "installed"] as const,
    sources: () => [...queryKeys.skills.all, "sources"] as const,
    updates: () => [...queryKeys.skills.all, "updates"] as const,
    detail: (name: string) => [...queryKeys.skills.all, "detail", name] as const,
  },

  runs: {
    all: ["runs"] as const,
    list: (filters?: RunsFilter) =>
      [...queryKeys.runs.all, "list", normalizeRunsFilter(filters)] as const,
    detail: (id: string) => [...queryKeys.runs.all, "detail", id] as const,
    children: (id: string) => [...queryKeys.runs.all, "children", id] as const,
  },

  prompts: {
    all: ["prompts"] as const,
    recent: () => [...queryKeys.prompts.all, "recent"] as const,
    saved: (opts?: { category?: string; q?: string }) => ["saved-prompts", opts ?? {}] as const,
  },

  settings: {
    all: ["settings"] as const,
    detail: () => [...queryKeys.settings.all, "detail"] as const,
    scan: (root: string, excluded: string[]) =>
      [...queryKeys.settings.all, "scan", root, excluded] as const,
  },
} as const;
