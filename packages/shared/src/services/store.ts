import type { PersistedRun, SavedPrompt } from "../types/index";
import * as db from "./db";

export function getRuns(opts: { agentId?: string; projectId?: string; instanceId?: string; limit?: number } = {}): PersistedRun[] {
  return db.listRuns(opts);
}

export function getRun(id: string): PersistedRun | null {
  return db.getRun(id);
}

export function markRunAborted(id: string): void {
  db.markRunAborted(id);
}

export function pushRun(run: PersistedRun): void {
  // upsert - run may already exist (inserted at startRun time)
  db.updateRun(run.id, {
    status: run.status,
    exitCode: run.exitCode,
    output: run.output,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
    costUsd: run.cost,
    durMs: run.durMs,
    sessionId: run.sessionId,
    endedAt: run.ts + run.durMs,
  });
}

export function getChildRuns(parentRunId: string): PersistedRun[] {
  return db.getChildRuns(parentRunId);
}

export function deleteRunsForInstance(projectId: string, instanceId: string): number {
  return db.deleteRunsForInstance(projectId, instanceId);
}

export function deleteRunsByAgent(agentId: string): number {
  return db.deleteRunsByAgent(agentId);
}

export function getRecentPrompts(agentId: string): string[] {
  return db.getRecentPrompts(agentId);
}

export function pushRecentPrompt(agentId: string, prompt: string): void {
  db.pushRecentPrompt(agentId, prompt);
}

export function getAllRecentPrompts(): Record<string, string[]> {
  return db.getAllRecentPrompts();
}

// ─── Saved prompts ─────────────────────────────────────────────────────────────

export function getSavedPrompts(opts?: { category?: string; q?: string }): SavedPrompt[] {
  return db.getSavedPrompts(opts);
}

export function getSavedPrompt(id: string): SavedPrompt | null {
  return db.getSavedPrompt(id);
}

export function createSavedPrompt(data: { title: string; body: string; category?: string }): SavedPrompt {
  return db.createSavedPrompt(data);
}

export function deleteSavedPrompt(id: string): void {
  db.deleteSavedPrompt(id);
}

export function recordSavedPromptUsage(id: string): void {
  db.recordSavedPromptUsage(id);
}

export function bulkInsertSavedPrompts(
  prompts: Array<{ title: string; body: string; category: string }>
): number {
  return db.bulkInsertSavedPrompts(prompts);
}
