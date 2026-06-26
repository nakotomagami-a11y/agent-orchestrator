/**
 * Centralized URL config - every route, page, and external endpoint string
 * lives here. Never hardcode URLs anywhere else.
 *
 * Mirrors `packages/shared/src/config/routes.ts` rule from the architecture.
 */

export const PAGE_ROUTES = {
  /** Landing page / office island — the root route. Use this; there is no separate `home` alias. */
  office: "/",
  agents: "/agents",
  agent: (id: string) => `/agents/${encodeURIComponent(id)}`,
  agentEdit: (id: string) => `/agents/${encodeURIComponent(id)}/edit`,
  agentNew: "/agents/new",
  projects: "/projects",
  project: (id: string) => `/projects/${encodeURIComponent(id)}`,
  skills: "/skills",
  memory: "/memory",
  run: (id: string) => `/runs/${encodeURIComponent(id)}`,
  settings: "/settings",
  activity: "/activity",
  docs: "/docs",
} as const;

export const API_ROUTES = {
  health: "/api/health",
  templates: "/api/templates",

  agents: "/api/agents",
  agentsBulk: "/api/agents/bulk",
  agent: (id: string) => `/api/agents/${encodeURIComponent(id)}`,
  agentBody: (id: string) => `/api/agents/${encodeURIComponent(id)}/body`,
  agentMemory: (id: string) => `/api/agents/${encodeURIComponent(id)}/memory`,
  agentPrompts: (id: string) => `/api/agents/${encodeURIComponent(id)}/prompts`,
  agentUploads: (id: string) => `/api/agents/${encodeURIComponent(id)}/uploads`,
  agentUploadFile: (id: string, filename: string) =>
    `/api/agents/${encodeURIComponent(id)}/uploads/${encodeURIComponent(filename)}`,

  memoryGlobal: "/api/memory/global",

  uiSettings: "/api/ui-settings",
  transcripts: "/api/transcripts",
  drafts: "/api/drafts",

  projects: "/api/projects",
  projectsBootstrap: "/api/projects/bootstrap",
  project: (id: string) => `/api/projects/${encodeURIComponent(id)}`,
  projectMemory: (id: string) => `/api/projects/${encodeURIComponent(id)}/memory`,
  projectRoster: (id: string) => `/api/projects/${encodeURIComponent(id)}/roster`,
  projectRosterItem: (projectId: string, instanceId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/roster/${encodeURIComponent(instanceId)}`,
  projectUploads: (id: string) => `/api/projects/${encodeURIComponent(id)}/uploads`,
  projectUploadFile: (id: string, filename: string) =>
    `/api/projects/${encodeURIComponent(id)}/uploads/${encodeURIComponent(filename)}`,

  skillsRegistry: "/api/skills/registry",
  skillsInstalled: "/api/skills/installed",
  skillsSources: "/api/skills/sources",
  skillsUpdates: "/api/skills/updates",
  skillsInstall: "/api/skills/install",
  skill: (name: string) => `/api/skills/${encodeURIComponent(name)}`,
  skillUpdate: (name: string) => `/api/skills/${encodeURIComponent(name)}/update`,

  runs: "/api/runs",
  run: (id: string) => `/api/runs/${encodeURIComponent(id)}`,
  runStream: (id: string) => `/api/runs/${encodeURIComponent(id)}/stream`,
  runAbort: (id: string) => `/api/runs/${encodeURIComponent(id)}/abort`,
  runChildren: (id: string) => `/api/runs/${encodeURIComponent(id)}/children`,

  summon: "/api/summon",
  broadcast: "/api/broadcast",

  settings: "/api/settings",
  settingsScan: "/api/settings/scan",

  savedPrompts: "/api/saved-prompts",
  savedPromptById: (id: string) => `/api/saved-prompts/${id}`,
  savedPromptUse: (id: string) => `/api/saved-prompts/${id}/use`,
  savedPromptsBulk: "/api/saved-prompts/bulk",
} as const;

/**
 * External endpoints (git registries, etc). When new external integrations
 * are added, define their builders here.
 */
export const EXTERNAL_API = {
  github: {
    repoContents: (owner: string, repo: string, path: string, ref = "main") =>
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    rawFile: (owner: string, repo: string, ref: string, path: string) =>
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
  },
} as const;
