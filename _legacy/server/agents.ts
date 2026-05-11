import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ApiAgent, AgentBody } from "../shared/types";
import { buildSkillsPrompt } from "./skills";
import { readProject } from "./projects";
import type { Project } from "../shared/types";

export const AGENTS_DIR = join(homedir(), ".claude", "agents");
export const GLOBAL_MEMORY_PATH = join(AGENTS_DIR, "_global.memory.md");

interface ParsedFile { fm: Record<string, unknown>; body: string; }

function parseFrontmatter(content: string): ParsedFile {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  let fm: Record<string, unknown> = {};
  try { fm = parseYaml(m[1]) ?? {}; } catch { fm = {}; }
  return { fm, body: m[2] };
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v === "string") {
    return v.replace(/^\[|\]$/g, "")
      .split(",")
      .map(s => s.trim().replace(/^["']|["']$/g, ""))
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
  };
  return { info, body: body.trim() };
}

export function listAgents(): ApiAgent[] {
  if (!existsSync(AGENTS_DIR)) return [];
  return readdirSync(AGENTS_DIR)
    .filter(f => f.endsWith(".md") && !f.endsWith(".memory.md") && !f.startsWith("_"))
    .map(f => readAgent(f.replace(/\.md$/, ""))?.info)
    .filter((a): a is ApiAgent => a !== undefined);
}

export function writeAgent(b: AgentBody): string {
  if (!existsSync(AGENTS_DIR)) mkdirSync(AGENTS_DIR, { recursive: true });
  const id = b.id.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  if (!id) throw new Error("invalid id");
  const file = join(AGENTS_DIR, `${id}.md`);
  const fm: Record<string, unknown> = {
    name: id,
    description: b.desc.replace(/\n/g, " "),
    "default-model": b.model,
    "default-effort": b.effort,
    skills: b.skills,
    tools: b.tools,
    "permission-mode": b.pm,
  };
  if (b.room) fm.room = b.room;
  const content = `---\n${stringifyYaml(fm).trim()}\n---\n\n${b.body}\n`;
  writeFileSync(file, content);
  return id;
}

// ─── Memory files ───

export function memoryPathFor(agent: string): string {
  return join(AGENTS_DIR, `${agent}.memory.md`);
}

export function readMemory(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function writeMemory(path: string, content: string): void {
  if (!existsSync(AGENTS_DIR)) mkdirSync(AGENTS_DIR, { recursive: true });
  writeFileSync(path, content);
}

/**
 * Composition order: skills → global → project → per-agent.
 * Pass a pre-resolved `Project` to avoid re-reading from disk when the caller
 * already has it (e.g. the WS summon handler also needs the project for cwd).
 * Pass a `string` projectId for convenience when the project hasn't been read yet.
 * Pass `undefined`/`null` for an out-of-project summon (legacy path).
 */
export function buildAppendedPrompt(
  agentName: string,
  projectOrId?: Project | string | null,
): string {
  const agent = readAgent(agentName);
  const skillFragment = agent ? buildSkillsPrompt(agent.info.skills).trim() : "";
  const global = readMemory(GLOBAL_MEMORY_PATH).trim();
  const project: Project | null = typeof projectOrId === "string"
    ? readProject(projectOrId)
    : (projectOrId ?? null);
  const projectMemory = project?.memory.trim() ?? "";
  const perAgent = readMemory(memoryPathFor(agentName)).trim();

  const parts: string[] = [];
  if (skillFragment) parts.push("## Capabilities (from selected skills)\n\n" + skillFragment);
  if (global) parts.push("## Global memory (applies to every agent)\n" + global);
  if (projectMemory) {
    parts.push(`## Project memory (${project!.meta.name})\n` + projectMemory);
  }
  if (perAgent) parts.push(`## Memory specific to ${agentName}\n` + perAgent);
  return parts.join("\n\n");
}
