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
  /** Extra directories the agent is allowed to read/write beyond the cwd. Passed as --add-dir. */
  addDirs?: string[];
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
  /** Claude CLI session ID - pass as --resume on the next turn. */
  sessionId?: string;
  /** Set for sub-agent runs spawned by a Task tool call. */
  parentRunId?: string;
}

/**
 * A node in the live spawn tree for a run. Built by walking `parentRunId` links
 * (DB) and overlaying in-flight `liveRuns` state. Powers the Workflow pill/tree.
 */
export interface WorkflowNode {
  runId: string;
  agentId: string;
  agentName: string;
  status: PersistedRun["status"];
  prompt: string;
  startTs: number;
  durMs: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  currentTool?: string;
  children: WorkflowNode[];
}

export interface AgentInstance {
  instanceId: string;
  agentId: string;
  label?: string;
  model?: string;
  effort?: string;
  permissionMode?: string;
  room?: string;
  /** Absolute path to the git worktree for this instance. Falls back to project.meta.cwd when unset. */
  cwd?: string;
  worktree?: {
    branch: string;   // e.g. "agent/frontend-craftsman-abc1-1716800000000"
    basePath: string; // e.g. "/path/to/project/.worktrees/frontend-craftsman-abc1"
    createdAt: number; // unix ms
  };
  /**
   * Transient (never persisted): set by the project read API when the instance
   * is pinned to a git worktree whose directory is missing on disk, so the UI
   * can surface a "needs repair" badge. Healed automatically on next run/boot.
   */
  worktreeMissing?: boolean;
}

export type PlanetType = "gas-giant" | "rocky" | "dry" | "terran" | "ice" | "islands" | "lava" | "black-hole" | "galaxy" | "star" | "asteroid";

export interface PlanetConfig {
  type: PlanetType;
  seed: number;
  paletteIdx: number;
  pixels?: number;   // logical pixel density 10-300, default 50
  rotation?: number; // radians, default derived from seed
  dither?: boolean;  // dither mode, default true
  customPalette?: [number, number, number][][]; // per-layer color overrides (RGB 0-1)
}

export interface ProjectMeta {
  name: string;
  description: string;
  cwd?: string;
  roster: AgentInstance[];
  planet?: PlanetConfig;
  /**
   * Multi-account: which Claude account (from the `accounts` service) runs
   * `claude` for this project. `undefined` (or `"default"`) → use the shared
   * `~/.claude`. Set via the project detail account picker (slice 4).
   */
  accountId?: string;
}

/**
 * A Claude Code account registered with agent-office. Every account has its
 * own `CLAUDE_CONFIG_DIR` (see `accountConfigDir(id)` in paths.ts). The
 * `default` account is auto-inserted on boot and points at `~/.claude`; all
 * others live under `~/.claude/agent-office/accounts/<id>/` with a real
 * `.credentials.json` plus symlinks to `~/.claude/agents`, `skills`, etc.
 */
export interface Account {
  id: string;
  label: string;
  configDir: string;
  createdAt: number;
}

export type ClaudePlan = "free" | "pro" | "max" | "api" | "custom";

export interface AccountWithStatus extends Account {
  plan: ClaudePlan;
  email?: string;
  /** True when `<configDir>/.credentials.json` exists and parses. */
  ready: boolean;
}

export interface AppSettings {
  projectsRoot: string;
  excluded: string[];
  firstRunComplete: boolean;
  features?: {
    multiInstance?: boolean;
  };
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
  runCount?: number;
  lastRunAt?: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  cwd?: string;
  instanceCount: number;
  lastRunAt?: number;
  planet?: PlanetConfig;
}

export interface HealthInfo {
  available: boolean;
  version: string | null;
  error?: string;
}

/**
 * A reusable multi-step prompt in the workflow library. Under the hood the
 * DB table is still `saved_prompts` (rename would risk live data) but every
 * surface — API paths, types, UI — talks about workflows.
 */
export interface Workflow {
  id: string;
  title: string;
  body: string;
  /** Category slug. Starter workflows use `"starter"`; user-authored can use
   *  any string. Used for the picker's tab filter. */
  category: string;
  createdAt: number;
  useCount: number;
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
  /** Session ID from the previous turn - passed as --resume to continue the conversation. */
  resumeSessionId?: string;
  /** How much prior-conversation context to inject. Defaults to "balanced". */
  contextProfile?: ContextProfile;
}

export type ContextProfile = "tight" | "balanced" | "deep";

export type SseEventName = "chunk" | "tool" | "usage" | "done" | "error" | "attached" | "subagent" | "subagent-update" | "rate-limit";

export interface SseChunkEvent { runId: string; text: string }
export interface SseToolEvent { runId: string; name: string; input?: unknown }
export interface SseUsageEvent { runId: string; tokensIn: number; tokensOut: number; cost: number }
export interface SseDoneEvent { runId: string; exitCode: number; sessionId?: string; durationMs?: number; tokensIn?: number; tokensOut?: number; cost?: number }
export interface SseErrorEvent { runId: string; message: string }
export interface SseRateLimitEvent { runId: string; message: string; resetsAt?: number }
export interface SseAttachedEvent {
  runId: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  status: PersistedRun["status"];
  startTs: number;
}

export type SubAgentStatus = "queued" | "running" | "cancelling" | "done" | "error" | "cancelled" | "timeout";

export interface SseSubAgentEvent {
  type: "subagent";
  parentRunId: string;
  subRunId: string;
  agentId: string;
  prompt: string;
  status: SubAgentStatus;
}

export interface SseSubAgentUpdateEvent {
  type: "subagent-update";
  subRunId: string;
  status: SubAgentStatus;
  currentTool?: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  lastOutputLine?: string;
}

export type RunStreamEvent =
  | { name: "attached"; data: SseAttachedEvent }
  | { name: "chunk"; data: SseChunkEvent }
  | { name: "tool"; data: SseToolEvent }
  | { name: "usage"; data: SseUsageEvent }
  | { name: "done"; data: SseDoneEvent }
  | { name: "error"; data: SseErrorEvent }
  | { name: "rate-limit"; data: SseRateLimitEvent }
  | { name: "subagent"; data: SseSubAgentEvent }
  | { name: "subagent-update"; data: SseSubAgentUpdateEvent };

// ─── Pipeline types ──────────────────────────────────────────────────────────

export interface PipelineStep {
  agentId: string;
  instanceId?: string;
  /** May contain {{output}} which is replaced by the previous step's finalised output. */
  promptTemplate: string;
  model?: string;
  effort?: string;
}

/** A group of steps that run concurrently; outputs are joined for the next sequential step. */
export interface ParallelPipelineStep {
  kind: "parallel";
  steps: PipelineStep[];
}

export interface CreatePipelineRequest {
  steps: (PipelineStep | ParallelPipelineStep)[];
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
  /** When set, this step belongs to a parallel group; steps with the same value run concurrently. */
  parallelGroup?: number;
}

export interface PipelineRun {
  id: string;
  projectId?: string;
  steps: PipelineRunStep[];
  status: "running" | "done" | "error";
  createdAt: number;
  /** True when the server restarted while this pipeline was running. */
  interrupted?: boolean;
}

/**
 * A project tab in the Chrome-style tab strip. One tab per project (MVP);
 * opening an already-tabbed project focuses the existing tab. Each tab
 * remembers its last-known route so switching tabs restores where the user
 * was inside that project (agent details modal, memory view, docs sub-route,
 * etc.). Persisted server-side under `ui_settings.tabs-state` as a JSON blob
 * of the full `TabsState`.
 */
export interface Tab {
  /** Stable id (uuid). Distinct from `projectId` because a project can be
   * closed and re-opened as a different tab instance in future iterations. */
  id: string;
  projectId: string;
  /** Last-known route within this tab, e.g. `/projects/inwhite`. Updated
   * whenever the user navigates inside the active tab. */
  currentPath: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
}
