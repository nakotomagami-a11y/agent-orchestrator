// Agent definitions: ~/.claude/agents/<id>.md (YAML frontmatter + markdown body).
// Sibling memory file at ~/.claude/agents/<id>.memory.md.
//
// `buildAppendedPrompt` composes the per-summon system prompt from skills +
// global memory + project memory + per-agent memory.

import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { ApiAgent, AgentBody, Project } from "../types/index";
import { AGENTS_DIR, GLOBAL_MEMORY_PATH, isValidIdSegment } from "./paths";
import { ensureDir, writeFileAtomic } from "./fs-atomic";
import { isYamlMapping, parseYaml, stringifyYaml, type YamlMapping, type YamlValue } from "./yaml";
import { buildSkillsPrompt } from "./skills";
import { historyNote } from "./history";

interface ParsedFile {
  fm: YamlMapping;
  body: string;
}

function parseFrontmatter(content: string): ParsedFile {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  let fm: YamlMapping = {};
  try {
    const parsed = parseYaml(m[1]!);
    if (isYamlMapping(parsed)) fm = parsed;
  } catch {
    fm = {};
  }
  return { fm, body: m[2]! };
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    return v
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return [];
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function readAgent(name: string): { info: ApiAgent; body: string } | null {
  const path = join(AGENTS_DIR, `${name}.md`);
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf8");
  const { fm, body } = parseFrontmatter(content);
  const info: ApiAgent = {
    name: asString(fm.name) ?? name,
    description: asString(fm.description) ?? "",
    skills: asStringList(fm.skills),
    tools: asStringList(fm.tools ?? fm["allowed-tools"]),
    defaultModel: asString(fm["default-model"] ?? fm.model),
    defaultEffort: asString(fm["default-effort"] ?? fm.effort),
    permissionMode: asString(fm["permission-mode"]),
    room: asString(fm.room),
    addDirs: asStringList(fm["add-dirs"] ?? fm["addDirs"]),
    unit: asString(fm.unit),
  };
  return { info, body: body.trim() };
}

export function listAgents(): ApiAgent[] {
  if (!existsSync(AGENTS_DIR)) return [];
  return readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md") && !f.endsWith(".memory.md") && !f.startsWith("_"))
    .map((f) => readAgent(f.replace(/\.md$/, ""))?.info)
    .filter((a): a is ApiAgent => a !== undefined);
}

export function writeAgent(b: AgentBody): string {
  ensureDir(AGENTS_DIR);
  if (!isValidIdSegment(b.id)) throw new Error("invalid id");
  const id = b.id;
  const file = join(AGENTS_DIR, `${id}.md`);
  const fm: Record<string, YamlValue> = {
    name: id,
    description: b.desc.replace(/\n/g, " "),
    "default-model": b.model,
    "default-effort": b.effort,
    skills: b.skills,
    tools: b.tools,
    "permission-mode": b.pm,
  };
  if (b.room) fm.room = b.room;
  if (b.unit && b.unit.trim()) fm.unit = b.unit.trim();
  const content = `---\n${stringifyYaml(fm).trim()}\n---\n\n${b.body}\n`;
  writeFileAtomic(file, content);
  return id;
}

export function deleteAgent(id: string): boolean {
  const mdPath = join(AGENTS_DIR, `${id}.md`);
  if (!existsSync(mdPath)) return false;
  rmSync(mdPath);
  const memPath = memoryPathFor(id);
  if (existsSync(memPath)) rmSync(memPath);
  return true;
}

// ─── Memory files ────────────────────────────────────────────────────────

export function memoryPathFor(agent: string): string {
  return join(AGENTS_DIR, `${agent}.memory.md`);
}

export function readMemory(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function writeMemoryFile(path: string, content: string): void {
  ensureDir(AGENTS_DIR);
  writeFileAtomic(path, content);
}

export function readGlobalMemory(): string {
  return readMemory(GLOBAL_MEMORY_PATH);
}

export function writeGlobalMemory(content: string): void {
  writeMemoryFile(GLOBAL_MEMORY_PATH, content);
}

export function readAgentMemory(agentId: string): string {
  return readMemory(memoryPathFor(agentId));
}

export function writeAgentMemory(agentId: string, content: string): void {
  writeMemoryFile(memoryPathFor(agentId), content);
}

/**
 * Composition order: skills → global → project → per-agent → history note.
 * Caller passes a pre-resolved `Project` (or null) — we don't import the
 * projects service here to avoid a cycle.
 */
export function buildAppendedPrompt(agentName: string, project: Project | null, instanceId?: string): string {
  const agent = readAgent(agentName);
  const skillFragment = agent ? buildSkillsPrompt(agent.info.skills).trim() : "";
  const global = readGlobalMemory().trim();
  const projectMemory = project?.memory.trim() ?? "";
  const perAgent = readAgentMemory(agentName).trim();
  const permissionMode = agent?.info.permissionMode;

  const parts: string[] = [];
  if (skillFragment) parts.push("## Capabilities (from selected skills)\n\n" + skillFragment);
  if (global) parts.push("## Global memory (applies to every agent)\n" + global);
  if (project) {
    const projectLines = [`**Project:** ${project.meta.name}`];
    if (project.meta.cwd) projectLines.push(`**Working directory:** ${project.meta.cwd}`);
    if (project.meta.description) projectLines.push(`**Description:** ${project.meta.description}`);
    parts.push(`## Active project\n` + projectLines.join("\n"));
  }
  if (projectMemory) parts.push(`## Project memory (${project!.meta.name})\n` + projectMemory);
  if (perAgent) parts.push(`## Memory specific to ${agentName}\n` + perAgent);

  if (permissionMode !== "plan") {
    const effectiveInstanceId = instanceId ?? "default";
    const hNote = historyNote(agentName, effectiveInstanceId);
    parts.push(
      `## Conversation history\n` +
      `Your past runs are stored in SQLite: ${hNote}\n` +
      `Use the sqlite3 command shown above to read past context when you need to recall previous sessions.`
    );
  }

  return parts.join("\n\n");
}
