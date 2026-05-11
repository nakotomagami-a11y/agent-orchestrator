// Run history persistence (JSONL append) + recent prompts.

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { PersistedRun } from "../shared/types";

const STORE_DIR = join(homedir(), ".claude", "agents");
const RUNS_LOG = join(STORE_DIR, "_runs.log");
const PROMPTS_FILE = join(STORE_DIR, "_recent_prompts.json");
const MAX_RUNS_IN_MEMORY = 200;
const MAX_OUTPUT_PER_RUN = 256 * 1024; // 256 KB cap; truncate on persist
const MAX_RECENT_PROMPTS_PER_AGENT = 10;

let cachedRuns: PersistedRun[] | null = null;

function ensureDir() {
  const dir = dirname(RUNS_LOG);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadRunsFromDisk(): PersistedRun[] {
  if (!existsSync(RUNS_LOG)) return [];
  try {
    const raw = readFileSync(RUNS_LOG, "utf8");
    const lines = raw.split("\n").filter(l => l.trim());
    const parsed: PersistedRun[] = [];
    for (const line of lines) {
      try { parsed.push(JSON.parse(line) as PersistedRun); } catch {}
    }
    parsed.sort((a, b) => b.ts - a.ts);
    return parsed.slice(0, MAX_RUNS_IN_MEMORY);
  } catch {
    return [];
  }
}

export function getRuns(): PersistedRun[] {
  if (cachedRuns === null) cachedRuns = loadRunsFromDisk();
  return cachedRuns;
}

export function pushRun(run: PersistedRun) {
  ensureDir();
  // Prime the cache BEFORE appending. If we appended first and then lazy-loaded,
  // loadRunsFromDisk would re-read the just-appended row and the subsequent
  // unshift would add it again — every run would be duplicated in memory.
  if (cachedRuns === null) cachedRuns = loadRunsFromDisk();
  const truncated: PersistedRun = {
    ...run,
    output: run.output.length > MAX_OUTPUT_PER_RUN
      ? run.output.slice(0, MAX_OUTPUT_PER_RUN) + "\n…[truncated]"
      : run.output,
  };
  appendFileSync(RUNS_LOG, JSON.stringify(truncated) + "\n");
  cachedRuns.unshift(truncated);
  if (cachedRuns.length > MAX_RUNS_IN_MEMORY) cachedRuns.length = MAX_RUNS_IN_MEMORY;
}

/**
 * Delete every persisted run matching (projectId, instanceId) from disk and
 * the in-memory cache. Used when an instance is removed from a project's
 * roster — re-adding the agent (which reuses the instance id) should start
 * with a clean history.
 *
 * Rewrites the full log file based on disk contents so older runs beyond the
 * in-memory cache are cleaned too. Returns the number of runs removed.
 */
export function deleteRunsForInstance(projectId: string, instanceId: string): number {
  if (!existsSync(RUNS_LOG)) return 0;
  let raw: string;
  try { raw = readFileSync(RUNS_LOG, "utf8"); } catch { return 0; }
  const lines = raw.split("\n").filter(l => l.trim());

  let removed = 0;
  const survivors: string[] = [];
  for (const line of lines) {
    let run: PersistedRun | null = null;
    try { run = JSON.parse(line) as PersistedRun; } catch { /* keep malformed lines */ }
    if (run && run.projectId === projectId && run.instanceId === instanceId) {
      removed++;
      continue;
    }
    survivors.push(line);
  }

  if (removed === 0) return 0;
  writeFileSync(RUNS_LOG, survivors.join("\n") + (survivors.length ? "\n" : ""));
  if (cachedRuns !== null) {
    cachedRuns = cachedRuns.filter(r => !(r.projectId === projectId && r.instanceId === instanceId));
  }
  return removed;
}

// ─── Recent prompts ───

let cachedPrompts: Record<string, string[]> | null = null;

function loadPrompts(): Record<string, string[]> {
  if (!existsSync(PROMPTS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(PROMPTS_FILE, "utf8")) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function savePrompts(p: Record<string, string[]>) {
  ensureDir();
  writeFileSync(PROMPTS_FILE, JSON.stringify(p, null, 2));
}

export function getRecentPrompts(agentId: string): string[] {
  if (cachedPrompts === null) cachedPrompts = loadPrompts();
  return cachedPrompts[agentId] ?? [];
}

export function pushRecentPrompt(agentId: string, prompt: string) {
  if (!prompt.trim()) return;
  if (cachedPrompts === null) cachedPrompts = loadPrompts();
  const list = (cachedPrompts[agentId] ?? []).filter(p => p !== prompt);
  list.unshift(prompt);
  cachedPrompts[agentId] = list.slice(0, MAX_RECENT_PROMPTS_PER_AGENT);
  savePrompts(cachedPrompts);
}

export function getAllRecentPrompts(): Record<string, string[]> {
  if (cachedPrompts === null) cachedPrompts = loadPrompts();
  return { ...cachedPrompts };
}
