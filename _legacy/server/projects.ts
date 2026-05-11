// Projects — scanned from the user's projectsRoot directory.
// Each subdirectory of the root is a project (id = slug of dir name,
// cwd = full path). Per-project metadata lives optionally at
// ~/.claude/projects/<id>/project.md and stores: name override,
// description, roster of agent instances, and free-form project memory.

import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type {
  AgentInstance, Project, ProjectMeta, ProjectSummary, ScannedEntry,
} from "../shared/types";
import { log } from "./log";
import { readSettings, scanProjects, slugify } from "./settings";
import { deleteRunsForInstance } from "./store";

export { slugify };
export const PROJECTS_DIR = join(homedir(), ".claude", "projects");

function ensureDir() {
  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });
}

function metadataFile(id: string): string {
  return join(PROJECTS_DIR, id, "project.md");
}

interface ParsedMetadata { meta: Partial<ProjectMeta>; memory: string; }

function parseMetadataFile(content: string): ParsedMetadata {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, memory: content.trim() };
  let raw: Partial<ProjectMeta> = {};
  try { raw = (parseYaml(m[1]) ?? {}) as Partial<ProjectMeta>; } catch { raw = {}; }
  return { meta: raw, memory: m[2].trim() };
}

function readMetadata(id: string): ParsedMetadata | null {
  const path = metadataFile(id);
  if (!existsSync(path)) return null;
  try {
    return parseMetadataFile(readFileSync(path, "utf8"));
  } catch (e) {
    log.warn("project.metadata_parse_failed", { id, err: String(e) });
    return null;
  }
}

function normalizeRoster(raw: unknown): AgentInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentInstance[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.instanceId !== "string" || typeof o.agentId !== "string") continue;
    if (seen.has(o.instanceId)) continue;
    seen.add(o.instanceId);
    const inst: AgentInstance = { instanceId: o.instanceId, agentId: o.agentId };
    if (typeof o.label === "string") inst.label = o.label;
    if (typeof o.model === "string") inst.model = o.model;
    if (typeof o.effort === "string") inst.effort = o.effort;
    if (typeof o.permissionMode === "string") inst.permissionMode = o.permissionMode;
    if (typeof o.room === "string") inst.room = o.room;
    out.push(inst);
  }
  return out;
}

function writeMetadata(id: string, meta: Partial<ProjectMeta>, memory: string) {
  ensureDir();
  const dir = join(PROJECTS_DIR, id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fmObj: Record<string, unknown> = {};
  if (meta.name) fmObj.name = meta.name;
  if (meta.description) fmObj.description = meta.description;
  if (Array.isArray(meta.roster) && meta.roster.length > 0) fmObj.roster = meta.roster;
  const fmStr = Object.keys(fmObj).length === 0 ? "" : stringifyYaml(fmObj).trim();
  const body = memory.trim();
  let content = "";
  if (fmStr) content += `---\n${fmStr}\n---\n\n`;
  if (body) content += `${body}\n`;
  writeFileSync(metadataFile(id), content);
}

/**
 * Build a Project from a scanned dir + optional metadata file. The scan
 * gives us id/name/cwd; metadata can override the human name + add a
 * description + roster of instances + project memory.
 */
function projectFromScan(entry: ScannedEntry): Project {
  const md = readMetadata(entry.id);
  const meta: ProjectMeta = {
    name: md?.meta.name ?? entry.name,
    description: md?.meta.description ?? "",
    cwd: entry.fullPath,
    roster: normalizeRoster(md?.meta.roster),
  };
  return { id: entry.id, meta, memory: md?.memory ?? "" };
}

/** List projects discovered by scanning the configured projectsRoot. */
export function listProjectSummaries(): ProjectSummary[] {
  const settings = readSettings();
  if (!settings) return [];
  const scanned = scanProjects(settings.projectsRoot, settings.excluded);
  return scanned.map(entry => {
    const p = projectFromScan(entry);
    return {
      id: p.id,
      name: p.meta.name,
      description: p.meta.description,
      cwd: p.meta.cwd,
      instanceCount: p.meta.roster.length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function readProject(id: string): Project | null {
  const settings = readSettings();
  if (!settings) return null;
  const scanned = scanProjects(settings.projectsRoot, settings.excluded)
    .find(e => e.id === id);
  if (!scanned) return null;
  return projectFromScan(scanned);
}

/**
 * Update / save metadata for a scanned project. Writes only to
 * ~/.claude/projects/<id>/project.md — does NOT touch the user's actual
 * project directory.
 */
export function updateProject(
  id: string,
  patch: { meta?: Partial<ProjectMeta>; memory?: string },
): Project {
  const existing = readProject(id);
  if (!existing) throw new Error(`project '${id}' not found`);
  const meta: ProjectMeta = { ...existing.meta, ...patch.meta };
  if (patch.meta?.roster !== undefined) {
    meta.roster = normalizeRoster(patch.meta.roster);
  }
  // cwd is derived from scan; don't persist it
  const memory = patch.memory ?? existing.memory;
  writeMetadata(id, meta, memory);
  return { id, meta, memory };
}

/**
 * Delete the metadata file. Does NOT delete the user's actual project
 * directory — that one stays on disk and remains scannable.
 */
export function deleteProjectMetadata(id: string): boolean {
  const dir = join(PROJECTS_DIR, id);
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  log.info("project.metadata_deleted", { id });
  return true;
}

export const deleteProject = deleteProjectMetadata;

// ─── Roster operations ──────────────────────────────────────────────────

function makeInstanceId(agentId: string, existing: AgentInstance[]): string {
  const taken = new Set(existing.map(i => i.instanceId));
  for (let n = 1; n < 10000; n++) {
    const candidate = `${agentId}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // pathological — fall back to a timestamped id
  return `${agentId}-${Date.now()}`;
}

/** Add one instance of `agentId` to the project's roster. Returns the new instance. */
export function addInstance(
  projectId: string,
  agentId: string,
  init?: Partial<Omit<AgentInstance, "instanceId" | "agentId">>,
): { project: Project; instance: AgentInstance } {
  const p = readProject(projectId);
  if (!p) throw new Error(`project '${projectId}' not found`);
  const instance: AgentInstance = {
    instanceId: makeInstanceId(agentId, p.meta.roster),
    agentId,
    ...init,
  };
  const meta: ProjectMeta = { ...p.meta, roster: [...p.meta.roster, instance] };
  writeMetadata(projectId, meta, p.memory);
  log.info("project.instance_added", { projectId, instanceId: instance.instanceId, agentId });
  return { project: { id: projectId, meta, memory: p.memory }, instance };
}

/** Patch an existing instance's overrides (label/model/effort/room). */
export function patchInstance(
  projectId: string,
  instanceId: string,
  patch: Partial<Omit<AgentInstance, "instanceId" | "agentId">>,
): Project {
  const p = readProject(projectId);
  if (!p) throw new Error(`project '${projectId}' not found`);
  const idx = p.meta.roster.findIndex(i => i.instanceId === instanceId);
  if (idx === -1) throw new Error(`instance '${instanceId}' not found`);
  // Identity fields are immutable. Strip them even if the wire payload included them.
  const safe = { ...patch } as Record<string, unknown>;
  delete safe.instanceId;
  delete safe.agentId;
  const updated: AgentInstance = { ...p.meta.roster[idx], ...safe };
  // Allow explicit unset by passing empty string → undefined
  for (const k of ["label", "model", "effort", "permissionMode", "room"] as const) {
    if (k in patch && (patch as Record<string, unknown>)[k] === "") delete updated[k];
  }
  const roster = [...p.meta.roster];
  roster[idx] = updated;
  const meta = { ...p.meta, roster };
  writeMetadata(projectId, meta, p.memory);
  log.info("project.instance_patched", { projectId, instanceId });
  return { id: projectId, meta, memory: p.memory };
}

/** Remove an instance by id. Returns the updated project.
 *  Also wipes the instance's persisted run history — instance ids get reused
 *  (`<agentId>-1` comes back when the slot frees up), so leaving old runs
 *  attached would mean re-adding an agent reveals a previous incarnation's
 *  history.
 */
export function removeInstance(projectId: string, instanceId: string): Project {
  const p = readProject(projectId);
  if (!p) throw new Error(`project '${projectId}' not found`);
  const roster = p.meta.roster.filter(i => i.instanceId !== instanceId);
  if (roster.length === p.meta.roster.length) {
    throw new Error(`instance '${instanceId}' not found`);
  }
  const meta = { ...p.meta, roster };
  writeMetadata(projectId, meta, p.memory);
  const runsRemoved = deleteRunsForInstance(projectId, instanceId);
  log.info("project.instance_removed", { projectId, instanceId, runsRemoved });
  return { id: projectId, meta, memory: p.memory };
}

/** Look up an instance by id within a project. */
export function findInstance(project: Project | null, instanceId: string | undefined): AgentInstance | null {
  if (!project || !instanceId) return null;
  return project.meta.roster.find(i => i.instanceId === instanceId) ?? null;
}

// ─── Summon-time helpers ────────────────────────────────────────────────

export function readProjectMemory(id: string): string {
  const p = readProject(id);
  return p?.memory ?? "";
}

export function resolveSummonCwd(
  requested: string | undefined,
  project: Project | null,
): string | undefined {
  const r = requested?.trim();
  if (r) return r;
  return project?.meta.cwd?.trim() || undefined;
}

// ─── Legacy bootstrap — no-op ────────────────────────────────────────────
export function ensureDefaultProject(_allAgentIds: string[]): Project | null {
  return null;
}

// ─── Create-from-form (used by ProjectManageModal "Create" / "Clone") ───
export function createProjectMetadata(
  input: Partial<ProjectMeta> & { id?: string; name?: string },
): Project {
  const settings = readSettings();
  if (!settings) throw new Error("first-run setup not complete");
  const id = input.id?.trim() || slugify(input.name ?? "");
  if (!id) throw new Error("id or name required");
  const scanned = scanProjects(settings.projectsRoot, settings.excluded)
    .find(e => e.id === id);
  if (!scanned) {
    throw new Error(
      `no folder matching id '${id}' under ${settings.projectsRoot}. ` +
      "Create the folder on disk first.",
    );
  }
  const meta: ProjectMeta = {
    name: input.name ?? scanned.name,
    description: input.description ?? "",
    cwd: scanned.fullPath,
    roster: normalizeRoster(input.roster),
  };
  writeMetadata(id, meta, "");
  log.info("project.metadata_created", { id });
  return { id, meta, memory: "" };
}

export const createProject = createProjectMetadata;
