// Thin client over the server API. Recent-prompts cache mirrors localStorage for speed.

import type {
  ApiAgent, PersistedRun, HealthInfo, AgentBody,
  RegistrySkill, InstalledSkill, SkillUpdate,
  Project, ProjectMeta, ProjectSummary, AgentInstance,
  AppSettings, ScannedEntry,
} from "../../shared/types";

const PROMPT_CACHE_KEY = "agent-office:recent-prompts-cache";

export async function fetchAgents(): Promise<ApiAgent[]> {
  let r: Response;
  try { r = await fetch("/api/agents"); }
  catch (e) { throw new Error(`backend unreachable (is bun server/index.ts running?): ${String(e)}`); }
  if (!r.ok) throw new Error(`/api/agents → ${r.status}: ${await r.text()}`);
  const text = await r.text();
  if (!text.trim()) throw new Error("backend returned an empty body for /api/agents — the server is probably down or the vite proxy is failing.");
  try { return JSON.parse(text); }
  catch { throw new Error(`/api/agents returned non-JSON: ${text.slice(0, 120)}`); }
}

export async function fetchHealth(): Promise<HealthInfo> {
  return (await fetch("/api/health")).json();
}

export async function fetchRuns(limit = 200): Promise<PersistedRun[]> {
  return (await fetch(`/api/runs?limit=${limit}`)).json();
}

export async function fetchAgentBody(id: string): Promise<string> {
  return (await fetch(`/api/agents/${encodeURIComponent(id)}/body`)).text();
}

export async function fetchAllRecentPrompts(): Promise<Record<string, string[]>> {
  try {
    const r = await fetch("/api/prompts");
    if (!r.ok) return loadPromptCache();
    const data = await r.json();
    savePromptCache(data);
    return data;
  } catch {
    return loadPromptCache();
  }
}

export async function fetchRecentPrompts(agentId: string): Promise<string[]> {
  try {
    const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/prompts`);
    if (!r.ok) return loadPromptCache()[agentId] ?? [];
    return r.json();
  } catch {
    return loadPromptCache()[agentId] ?? [];
  }
}

export async function pushRecentPrompt(agentId: string, prompt: string): Promise<void> {
  const cache = loadPromptCache();
  cache[agentId] = [prompt, ...(cache[agentId] ?? []).filter(p => p !== prompt)].slice(0, 10);
  savePromptCache(cache);
  fetch(`/api/agents/${encodeURIComponent(agentId)}/prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  }).catch(() => {});
}

export async function fetchSkillRegistry(force = false): Promise<RegistrySkill[]> {
  const url = force ? "/api/skills/registry?refresh=1" : "/api/skills/registry";
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchInstalledSkills(): Promise<InstalledSkill[]> {
  return (await fetch("/api/skills/installed")).json();
}

export async function installSkillEntry(entry: RegistrySkill): Promise<void> {
  const r = await fetch("/api/skills/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: entry.source, ref: entry.ref, path: entry.path, name: entry.name }),
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function uninstallSkill(name: string): Promise<void> {
  const r = await fetch(`/api/skills/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

export async function fetchSkillSources(): Promise<Array<{ source: string; ref: string }>> {
  return (await fetch("/api/skills/sources")).json();
}

export async function fetchSkillUpdates(): Promise<SkillUpdate[]> {
  const r = await fetch("/api/skills/updates");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateSkill(name: string): Promise<void> {
  const r = await fetch(`/api/skills/${encodeURIComponent(name)}/update`, { method: "POST" });
  if (!r.ok) throw new Error(await r.text());
}

export async function saveAgent(data: AgentBody, mode: "create" | "edit" | "clone"): Promise<{ id: string }> {
  const url = mode === "edit" ? `/api/agents/${encodeURIComponent(data.id)}` : "/api/agents";
  const method = mode === "edit" ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAgent(id: string): Promise<void> {
  const r = await fetch(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

export async function bulkCreateAgents(items: AgentBody[]): Promise<{ written: string[]; errors: Array<{ id: string; error: string }> }> {
  const r = await fetch("/api/agents/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface TemplateEntry extends AgentBody {
  templateId: string;
  role: "Frontend" | "QA" | "Backend";
  philosophy: string;
  reasoning: string;
}

export async function fetchTemplates(): Promise<TemplateEntry[]> {
  return (await fetch("/api/templates")).json();
}

// ─── Settings ───

export async function fetchSettings(): Promise<AppSettings | null> {
  return (await fetch("/api/settings")).json();
}

export async function saveSettings(s: Pick<AppSettings, "projectsRoot" | "excluded">): Promise<AppSettings> {
  const r = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function scanProjectsRoot(root: string, excluded: string[] = [], includeExcluded = false): Promise<ScannedEntry[]> {
  const params = new URLSearchParams({ root, excluded: excluded.join(",") });
  if (includeExcluded) params.set("includeExcluded", "1");
  const r = await fetch(`/api/settings/scan?${params}`);
  if (!r.ok) return [];
  return r.json();
}

// ─── Projects ───

export async function fetchProjects(): Promise<ProjectSummary[]> {
  return (await fetch("/api/projects")).json();
}

export async function fetchProject(id: string): Promise<Project | null> {
  const r = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createProject(input: Partial<ProjectMeta> & { name: string }): Promise<Project> {
  const r = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateProjectMeta(
  id: string,
  patch: { meta?: Partial<ProjectMeta>; memory?: string },
): Promise<Project> {
  const r = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteProject(id: string): Promise<void> {
  const r = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

// ─── Roster ───

export async function addInstance(
  projectId: string,
  agentId: string,
  init?: Partial<AgentInstance>,
): Promise<{ project: Project; instance: AgentInstance }> {
  const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/roster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, init }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function patchInstance(
  projectId: string,
  instanceId: string,
  patch: Partial<AgentInstance>,
): Promise<Project> {
  const r = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/roster/${encodeURIComponent(instanceId)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function removeInstance(projectId: string, instanceId: string): Promise<Project> {
  const r = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/roster/${encodeURIComponent(instanceId)}`,
    { method: "DELETE" },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface Attachment {
  filename: string;
  path: string;
  size: number;
}

export async function listAttachments(agentId: string): Promise<Attachment[]> {
  const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/uploads`);
  if (!r.ok) return [];
  return r.json();
}

export async function uploadAttachment(agentId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/uploads`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteAttachment(agentId: string, filename: string): Promise<void> {
  const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/uploads/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(await r.text());
}

// Project-scoped attachments (preferred when a project is active)
export async function listProjectAttachments(projectId: string): Promise<Attachment[]> {
  const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/uploads`);
  if (!r.ok) return [];
  return r.json();
}

export async function uploadProjectAttachment(projectId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/uploads`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteProjectAttachment(projectId: string, filename: string): Promise<void> {
  const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(await r.text());
}

function loadPromptCache(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(PROMPT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePromptCache(data: Record<string, string[]>) {
  try { localStorage.setItem(PROMPT_CACHE_KEY, JSON.stringify(data)); } catch {}
}
