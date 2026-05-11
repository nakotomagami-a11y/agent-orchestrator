export type AgentStatus = "idle" | "working" | "done" | "error" | "thinking" | "queued";

export interface RegistrySkill {
  source: string;
  ref: string;
  name: string;
  description: string;
  path: string;
  sha: string;
  tags: string[];
  installed: boolean;
}

export interface SkillProvenance {
  source: string;
  ref: string;
  path: string;
  sha: string;
  installedAt: string;
}

export interface InstalledSkill {
  name: string;
  description: string;
  body: string;
  provenance?: SkillProvenance;
}

export interface SkillUpdate {
  name: string;
  currentSha: string;
  latestSha: string;
  source: string;
  path: string;
}

export interface ApiAgent {
  name: string;
  description: string;
  skills: string[];
  tools: string[];
  defaultModel?: string;
  defaultEffort?: string;
  permissionMode?: string;
  room?: string;
  /**
   * Optional avatar override in the form `"<faction>/<kind>"` (e.g.
   * `"blue/pawn"`). When unset the UI hashes the agent name to pick a
   * deterministic Tiny Swords unit.
   */
  unit?: string;
}

export interface AgentBody {
  name: string;
  id: string;
  desc: string;
  skills: string[];
  tools: string[];
  pm: string;
  model: string;
  effort: string;
  body: string;
  room?: string;
  /** Avatar override, see {@link ApiAgent.unit}. Empty string clears it. */
  unit?: string;
}

export interface PersistedRun {
  id: string;
  agentId: string;
  agentName: string;
  ts: number;
  prompt: string;
  status: "running" | "done" | "error";
  /** Subprocess exit code. 130 indicates SIGINT/SIGTERM (server restart). */
  exitCode?: number;
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  durMs: number;
  model: string;
  effort: string;
  cwd?: string;
  projectId?: string;
  instanceId?: string;
  instanceLabel?: string;
}

export interface AgentInstance {
  instanceId: string;
  agentId: string;
  label?: string;
  model?: string;
  effort?: string;
  permissionMode?: string;
  room?: string;
}

export interface ProjectMeta {
  name: string;
  description: string;
  cwd?: string;
  roster: AgentInstance[];
}

export interface AppSettings {
  projectsRoot: string;
  excluded: string[];
  firstRunComplete: boolean;
}

export interface ScannedEntry {
  id: string;
  name: string;
  fullPath: string;
  excluded: boolean;
}

export interface Project {
  id: string;
  meta: ProjectMeta;
  memory: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  cwd?: string;
  instanceCount: number;
}

export interface HealthInfo {
  available: boolean;
  version: string | null;
  error?: string;
}

export interface SummonRequest {
  agentId: string;
  prompt: string;
  model?: string;
  effort?: string;
  maxBudgetUsd?: number;
  cwd?: string;
  projectId?: string;
  instanceId?: string;
}

export type SseEventName = "chunk" | "tool" | "usage" | "done" | "error" | "attached";

export interface SseChunkEvent { runId: string; text: string }
export interface SseToolEvent { runId: string; name: string; input?: unknown }
export interface SseUsageEvent { runId: string; tokensIn: number; tokensOut: number; cost: number }
export interface SseDoneEvent { runId: string; exitCode: number }
export interface SseErrorEvent { runId: string; message: string }
export interface SseAttachedEvent {
  runId: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  status: PersistedRun["status"];
  startTs: number;
}

export type RunStreamEvent =
  | { name: "attached"; data: SseAttachedEvent }
  | { name: "chunk"; data: SseChunkEvent }
  | { name: "tool"; data: SseToolEvent }
  | { name: "usage"; data: SseUsageEvent }
  | { name: "done"; data: SseDoneEvent }
  | { name: "error"; data: SseErrorEvent };

// ─── Pipeline types ──────────────────────────────────────────────────────────

export interface PipelineStep {
  agentId: string;
  instanceId?: string;
  /** May contain {{output}} which is replaced by the previous step's finalised output. */
  promptTemplate: string;
  model?: string;
  effort?: string;
}

export interface CreatePipelineRequest {
  steps: PipelineStep[]; // min 2, max 10
  projectId?: string;
  cwd?: string;
}

export interface PipelineRunStep {
  stepIndex: number;
  agentId: string;
  runId: string;
  status: "pending" | "running" | "done" | "error";
  output?: string;
  exitCode?: number;
}

export interface PipelineRun {
  id: string;
  projectId?: string;
  steps: PipelineRunStep[];
  status: "running" | "done" | "error";
  createdAt: number;
}
