// Projects — scanned from the user's projectsRoot.
// Per-project metadata in ~/.claude/projects/<id>/project.md (YAML frontmatter + memory body).
// Rosters of agent instances live in that frontmatter.

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AgentInstance, Project, ProjectMeta, ProjectSummary, ScannedEntry } from "../types/index";
import { expandTilde, PROJECTS_DIR } from "./paths";
import { ensureDir, writeFileAtomic } from "./fs-atomic";
import { isYamlMapping, parseYaml, stringifyYaml, type YamlMapping, type YamlValue } from "./yaml";
import { log } from "./log";
import { readSettings, scanProjects, slugify } from "./settings";
import { deleteRunsForInstance } from "./store";
import { getDb } from "./db";

function metadataFile(id: string): string {
  return join(PROJECTS_DIR, id, "project.md");
}

interface ParsedMetadata { meta: Partial<ProjectMeta>; memory: string }

function parseMetadataFile(content: string): ParsedMetadata {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, memory: content.trim() };
  let raw: YamlMapping = {};
  try {
    const parsed = parseYaml(m[1]!);
    if (isYamlMapping(parsed)) raw = parsed;
  } catch {
    raw = {};
  }
  return { meta: yamlToProjectMeta(raw), memory: (m[2] ?? "").trim() };
}

function yamlToProjectMeta(m: YamlMapping): Partial<ProjectMeta> {
  const out: Partial<ProjectMeta> = {};
  if (typeof m.name === "string") out.name = m.name;
  if (typeof m.description === "string") out.description = m.description;
  if (Array.isArray(m.roster)) out.roster = normalizeRoster(m.roster);
  return out;
}

function rosterToYaml(roster: AgentInstance[]): YamlValue {
  return roster.map((inst) => {
    const o: YamlMapping = { instanceId: inst.instanceId, agentId: inst.agentId };
    if (inst.label !== undefined) o.label = inst.label;
    if (inst.model !== undefined) o.model = inst.model;
    if (inst.effort !== undefined) o.effort = inst.effort;
    if (inst.permissionMode !== undefined) o.permissionMode = inst.permissionMode;
    if (inst.room !== undefined) o.room = inst.room;
    return o;
  });
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

function writeMetadata(id: string, meta: Partial<ProjectMeta>, memory: string): void {
  ensureDir(PROJECTS_DIR);
  ensureDir(join(PROJECTS_DIR, id));
  const fmObj: YamlMapping = {};
  if (meta.name) fmObj.name = meta.name;
  if (meta.description) fmObj.description = meta.description;
  if (Array.isArray(meta.roster) && meta.roster.length > 0) {
    fmObj.roster = rosterToYaml(meta.roster);
  }
  const fmStr = Object.keys(fmObj).length === 0 ? "" : stringifyYaml(fmObj).trim();
  const body = memory.trim();
  let content = "";
  if (fmStr) content += `---\n${fmStr}\n---\n\n`;
  if (body) content += `${body}\n`;
  writeFileAtomic(metadataFile(id), content);
}

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

export function listProjectSummaries(): ProjectSummary[] {
  const settings = readSettings();
  if (!settings) return [];

  const lastRuns = new Map<string, number>();
  try {
    const rows = getDb()
      .prepare("SELECT project_id, MAX(started_at) as last_run FROM runs WHERE project_id IS NOT NULL GROUP BY project_id")
      .all() as { project_id: string; last_run: number }[];
    for (const row of rows) lastRuns.set(row.project_id, row.last_run);
  } catch { /* db not ready */ }

  return scanProjects(settings.projectsRoot, settings.excluded)
    .map((entry) => {
      const p = projectFromScan(entry);
      return {
        id: p.id,
        name: p.meta.name,
        description: p.meta.description,
        cwd: p.meta.cwd,
        instanceCount: p.meta.roster.length,
        lastRunAt: lastRuns.get(p.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function readProject(id: string): Project | null {
  const settings = readSettings();
  if (!settings) return null;
  const scanned = scanProjects(settings.projectsRoot, settings.excluded).find((e) => e.id === id);
  if (!scanned) return null;
  return projectFromScan(scanned);
}

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
  const memory = patch.memory ?? existing.memory;
  writeMetadata(id, meta, memory);
  return { id, meta, memory };
}

export function deleteProject(id: string): boolean {
  const dir = join(PROJECTS_DIR, id);
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  log.info("project.metadata_deleted", { id });
  return true;
}

/**
 * Generate an instance id that's never been used in this roster *and*
 * also includes a short timestamp/random suffix so re-adding the same
 * agent after a remove yields a fresh id — that's how chat transcripts
 * key off the instance, so collisions would carry old conversations
 * into a new "colleague".
 */
function makeInstanceId(agentId: string, existing: AgentInstance[]): string {
  const taken = new Set(existing.map((i) => i.instanceId));
  const suffix = () =>
    Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `${agentId}-${suffix()}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${agentId}-${Date.now()}`;
}

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

export function patchInstance(
  projectId: string,
  instanceId: string,
  patch: Partial<Omit<AgentInstance, "instanceId" | "agentId">>,
): Project {
  const p = readProject(projectId);
  if (!p) throw new Error(`project '${projectId}' not found`);
  const idx = p.meta.roster.findIndex((i) => i.instanceId === instanceId);
  if (idx === -1) throw new Error(`instance '${instanceId}' not found`);
  const updated: AgentInstance = { ...p.meta.roster[idx]!, ...patch };
  for (const k of ["label", "model", "effort", "permissionMode", "room"] as const) {
    if (k in patch && patch[k] === "") delete updated[k];
  }
  const roster = [...p.meta.roster];
  roster[idx] = updated;
  const meta = { ...p.meta, roster };
  writeMetadata(projectId, meta, p.memory);
  log.info("project.instance_patched", { projectId, instanceId });
  return { id: projectId, meta, memory: p.memory };
}

export function removeInstance(projectId: string, instanceId: string): Project {
  const p = readProject(projectId);
  if (!p) throw new Error(`project '${projectId}' not found`);
  const roster = p.meta.roster.filter((i) => i.instanceId !== instanceId);
  if (roster.length === p.meta.roster.length) {
    throw new Error(`instance '${instanceId}' not found`);
  }
  const meta = { ...p.meta, roster };
  writeMetadata(projectId, meta, p.memory);
  const runsRemoved = deleteRunsForInstance(projectId, instanceId);
  log.info("project.instance_removed", { projectId, instanceId, runsRemoved });
  return { id: projectId, meta, memory: p.memory };
}

export function findInstance(project: Project | null, instanceId: string | undefined): AgentInstance | null {
  if (!project || !instanceId) return null;
  return project.meta.roster.find((i) => i.instanceId === instanceId) ?? null;
}

export function readProjectMemory(id: string): string {
  return readProject(id)?.memory ?? "";
}

export function resolveSummonCwd(
  requested: string | undefined,
  project: Project | null,
): string | undefined {
  const r = requested?.trim();
  if (r) return r;
  return project?.meta.cwd?.trim() || undefined;
}

export interface CreateProjectInput {
  id?: string;
  name?: string;
  description?: string;
  roster?: unknown[];
}

export function createProject(input: CreateProjectInput): Project {
  const settings = readSettings();
  if (!settings) throw new Error("first-run setup not complete");
  const id = input.id?.trim() || slugify(input.name ?? "");
  if (!id) throw new Error("id or name required");
  let scanned = scanProjects(settings.projectsRoot, settings.excluded).find((e) => e.id === id);
  if (!scanned) {
    const newPath = join(expandTilde(settings.projectsRoot), id);
    mkdirSync(newPath, { recursive: true });
    log.info("project.folder_created", { path: newPath });
    scanned = scanProjects(settings.projectsRoot, settings.excluded).find((e) => e.id === id);
    if (!scanned) throw new Error(`failed to create project folder at ${newPath}`);
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
