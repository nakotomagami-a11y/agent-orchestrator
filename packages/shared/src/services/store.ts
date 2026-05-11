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

interface StoreState {
  cachedRuns: PersistedRun[] | null;
  cachedPrompts: Record<string, string[]> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __agentOfficeStoreState: StoreState | undefined;
}

const state: StoreState =
  globalThis.__agentOfficeStoreState ??
  (globalThis.__agentOfficeStoreState = { cachedRuns: null, cachedPrompts: null });

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
  if (state.cachedRuns === null) state.cachedRuns = loadRunsFromDisk();
  return state.cachedRuns;
}

export function getRun(id: string): PersistedRun | null {
  return getRuns().find((r) => r.id === id) ?? null;
}

export function pushRun(run: PersistedRun): void {
  ensureStateDir();
  if (state.cachedRuns === null) state.cachedRuns = loadRunsFromDisk();
  const truncated: PersistedRun = {
    ...run,
    output:
      run.output.length > MAX_OUTPUT_PER_RUN
        ? run.output.slice(0, MAX_OUTPUT_PER_RUN) + "\n…[truncated]"
        : run.output,
  };
  appendFileSync(RUNS_LOG, JSON.stringify(truncated) + "\n");
  state.cachedRuns.unshift(truncated);
  if (state.cachedRuns.length > MAX_RUNS_IN_MEMORY) state.cachedRuns.length = MAX_RUNS_IN_MEMORY;
}

/**
 * Delete every persisted run matching (projectId, instanceId) from the active
 * runs file and the in-memory cache. Used when an instance is removed from a
 * project's roster — re-adding the agent (which reuses the instance id) should
 * start with a clean history.
 */
export function deleteRunsForInstance(projectId: string, instanceId: string): number {
  if (!existsSync(RUNS_LOG)) {
    if (state.cachedRuns) {
      const before = state.cachedRuns.length;
      state.cachedRuns = state.cachedRuns.filter(
        (r) => !(r.projectId === projectId && r.instanceId === instanceId),
      );
      return before - state.cachedRuns.length;
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
  if (state.cachedRuns !== null) {
    state.cachedRuns = state.cachedRuns.filter(
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
  if (state.cachedPrompts === null) state.cachedPrompts = loadPrompts();
  return state.cachedPrompts[agentId] ?? [];
}

export function pushRecentPrompt(agentId: string, prompt: string): void {
  if (!prompt.trim()) return;
  if (state.cachedPrompts === null) state.cachedPrompts = loadPrompts();
  const list = (state.cachedPrompts[agentId] ?? []).filter((p) => p !== prompt);
  list.unshift(prompt);
  state.cachedPrompts[agentId] = list.slice(0, MAX_RECENT_PROMPTS_PER_AGENT);
  savePrompts(state.cachedPrompts);
}

export function getAllRecentPrompts(): Record<string, string[]> {
  if (state.cachedPrompts === null) state.cachedPrompts = loadPrompts();
  return { ...state.cachedPrompts };
}
