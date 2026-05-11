// Persistent run history (JSONL append) + recent prompts (atomic JSON).
//
// Persistence root moved to ~/.claude/agent-office/ — the legacy server kept
// these files inside ~/.claude/agents/ which mixed app state into Claude's own
// agent definitions. New installs land in the new dir; if the legacy files
// still exist on disk, we read them once on first load so history isn't lost.

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PersistedRun } from "../types/index";
import { writeFileAtomic } from "./fs-atomic";
import { APP_STATE_DIR, RUNS_LOG, PROMPTS_FILE, AGENTS_DIR } from "./paths";

const MAX_RUNS_IN_MEMORY = 200;
const MAX_OUTPUT_PER_RUN = 256 * 1024;
const MAX_RECENT_PROMPTS_PER_AGENT = 10;

const LEGACY_RUNS_LOG = join(AGENTS_DIR, "_runs.log");
const LEGACY_PROMPTS_FILE = join(AGENTS_DIR, "_recent_prompts.json");

let cachedRuns: PersistedRun[] | null = null;
let cachedPrompts: Record<string, string[]> | null = null;

function ensureStateDir(): void {
  if (!existsSync(APP_STATE_DIR)) mkdirSync(APP_STATE_DIR, { recursive: true });
}

function loadRunsFromDisk(): PersistedRun[] {
  const sources = [RUNS_LOG, LEGACY_RUNS_LOG].filter(existsSync);
  if (sources.length === 0) return [];
  const parsed: PersistedRun[] = [];
  for (const src of sources) {
    try {
      const raw = readFileSync(src, "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          parsed.push(JSON.parse(line) as PersistedRun);
        } catch {
          /* skip malformed line */
        }
      }
    } catch {
      /* skip unreadable file */
    }
  }
  parsed.sort((a, b) => b.ts - a.ts);
  return parsed.slice(0, MAX_RUNS_IN_MEMORY);
}

export function getRuns(): PersistedRun[] {
  if (cachedRuns === null) cachedRuns = loadRunsFromDisk();
  return cachedRuns;
}

export function getRun(id: string): PersistedRun | null {
  return getRuns().find((r) => r.id === id) ?? null;
}

export function pushRun(run: PersistedRun): void {
  ensureStateDir();
  if (cachedRuns === null) cachedRuns = loadRunsFromDisk();
  const truncated: PersistedRun = {
    ...run,
    output:
      run.output.length > MAX_OUTPUT_PER_RUN
        ? run.output.slice(0, MAX_OUTPUT_PER_RUN) + "\n…[truncated]"
        : run.output,
  };
  appendFileSync(RUNS_LOG, JSON.stringify(truncated) + "\n");
  cachedRuns.unshift(truncated);
  if (cachedRuns.length > MAX_RUNS_IN_MEMORY) cachedRuns.length = MAX_RUNS_IN_MEMORY;
}

/**
 * Delete every persisted run matching (projectId, instanceId) from the active
 * runs file and the in-memory cache. Used when an instance is removed from a
 * project's roster — re-adding the agent (which reuses the instance id) should
 * start with a clean history.
 */
export function deleteRunsForInstance(projectId: string, instanceId: string): number {
  if (!existsSync(RUNS_LOG)) {
    if (cachedRuns) {
      const before = cachedRuns.length;
      cachedRuns = cachedRuns.filter(
        (r) => !(r.projectId === projectId && r.instanceId === instanceId),
      );
      return before - cachedRuns.length;
    }
    return 0;
  }
  let raw: string;
  try {
    raw = readFileSync(RUNS_LOG, "utf8");
  } catch {
    return 0;
  }
  const lines = raw.split("\n").filter((l) => l.trim());
  let removed = 0;
  const survivors: string[] = [];
  for (const line of lines) {
    let run: PersistedRun | null = null;
    try {
      run = JSON.parse(line) as PersistedRun;
    } catch {
      /* keep malformed lines */
    }
    if (run && run.projectId === projectId && run.instanceId === instanceId) {
      removed++;
      continue;
    }
    survivors.push(line);
  }
  if (removed === 0) return 0;
  writeFileAtomic(RUNS_LOG, survivors.join("\n") + (survivors.length ? "\n" : ""));
  if (cachedRuns !== null) {
    cachedRuns = cachedRuns.filter(
      (r) => !(r.projectId === projectId && r.instanceId === instanceId),
    );
  }
  return removed;
}

// ─── Recent prompts ──────────────────────────────────────────────────────

function loadPrompts(): Record<string, string[]> {
  if (existsSync(PROMPTS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROMPTS_FILE, "utf8")) as Record<string, string[]>;
    } catch {
      /* fall through to legacy */
    }
  }
  if (existsSync(LEGACY_PROMPTS_FILE)) {
    try {
      return JSON.parse(readFileSync(LEGACY_PROMPTS_FILE, "utf8")) as Record<string, string[]>;
    } catch {
      return {};
    }
  }
  return {};
}

function savePrompts(p: Record<string, string[]>): void {
  ensureStateDir();
  writeFileAtomic(PROMPTS_FILE, JSON.stringify(p, null, 2));
}

export function getRecentPrompts(agentId: string): string[] {
  if (cachedPrompts === null) cachedPrompts = loadPrompts();
  return cachedPrompts[agentId] ?? [];
}

export function pushRecentPrompt(agentId: string, prompt: string): void {
  if (!prompt.trim()) return;
  if (cachedPrompts === null) cachedPrompts = loadPrompts();
  const list = (cachedPrompts[agentId] ?? []).filter((p) => p !== prompt);
  list.unshift(prompt);
  cachedPrompts[agentId] = list.slice(0, MAX_RECENT_PROMPTS_PER_AGENT);
  savePrompts(cachedPrompts);
}

export function getAllRecentPrompts(): Record<string, string[]> {
  if (cachedPrompts === null) cachedPrompts = loadPrompts();
  return { ...cachedPrompts };
}
