// Shared types between server and client. Both import from here.

export interface RegistrySkill {
  source: string;        // e.g. "anthropics/skills"
  ref: string;           // git ref, e.g. "main"
  name: string;          // directory name, e.g. "pdf"
  description: string;   // from SKILL.md frontmatter
  path: string;          // path within repo, e.g. "skills/pdf"
  sha: string;           // git blob SHA of the SKILL.md — for update detection
  tags: string[];        // auto-derived categorical tags for filtering/search
  installed: boolean;
}

export interface SkillProvenance {
  source: string;
  ref: string;
  path: string;
  sha: string;            // commit/blob SHA recorded at install time
  installedAt: string;    // ISO timestamp
}

export interface InstalledSkill {
  name: string;
  description: string;
  body: string;           // markdown body after frontmatter
  provenance?: SkillProvenance;
}

export interface SkillUpdate {
  name: string;
  currentSha: string;
  latestSha: string;
  source: string;
  path: string;
}


export type AgentStatus = "idle" | "working" | "done" | "error";

export interface ApiAgent {
  name: string;
  description: string;
  skills: string[];
  tools: string[];
  defaultModel?: string;
  defaultEffort?: string;
  permissionMode?: string;
  room?: string;
}

export interface PersistedRun {
  id: string;
  agentId: string;
  agentName: string;
  ts: number;
  prompt: string;
  status: "done" | "error";
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  durMs: number;
  model: string;
  effort: string;
  cwd?: string;
  projectId?: string;
  instanceId?: string;     // project roster instance, if summoned via one
  instanceLabel?: string;  // human label snapshotted at run time
}

/**
 * An instance is a named seat in a project's roster. Multiple instances may
 * share the same agentId (e.g. two "frontend" seats) — each gets its own
 * desk on the floor plan, its own run history, and optional per-instance
 * overrides for model/effort/permission/room.
 */
export interface AgentInstance {
  instanceId: string;        // stable id, unique within the project
  agentId: string;           // points to ~/.claude/agents/<agentId>.md
  label?: string;            // user-visible; falls back to agent name (+ "#N" if dup)
  model?: string;
  effort?: string;
  permissionMode?: string;
  room?: string;
}

export interface ProjectMeta {
  name: string;
  description: string;
  cwd?: string;              // set from scan; kept here so the client renders it
  roster: AgentInstance[];   // explicit, empty by default — user adds via "Add agent"
}

export interface AppSettings {
  projectsRoot: string;     // e.g. "/home/parlamentas/Documents/Lab"
  excluded: string[];       // bare dir names (e.g. "node_modules", "archive")
  firstRunComplete: boolean;
}

export interface ScannedEntry {
  id: string;        // slug of dir name
  name: string;      // raw dir name as it sits on disk
  fullPath: string;  // absolute path
  excluded: boolean; // currently filtered out
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
}

// WebSocket message types — both directions

export interface WSSummonRequest {
  type: "summon";
  runId: string;
  agent: string;        // agentId (definition); falls through to ~/.claude/agents/<agentId>.md
  prompt: string;
  model?: string;
  effort?: string;
  maxBudgetUsd?: number;
  cwd?: string;
  projectId?: string;
  instanceId?: string;  // when set, server resolves overrides + label from this roster entry
}

export interface WSAttachRequest {
  type: "attach";
  runId: string;
}

export type WSClientMessage = WSSummonRequest | WSAttachRequest;

export interface WSChunkEvent { type: "chunk"; text: string; }
export interface WSToolEvent { type: "tool"; name: string; input?: unknown; }
export interface WSUsageEvent { type: "usage"; tokensIn: number; tokensOut: number; cost: number; }
export interface WSDoneEvent { type: "done"; exitCode: number; }
export interface WSErrorEvent { type: "error"; message: string; }
export interface WSAttachedEvent {
  type: "attached";
  runId: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  status: "running" | "done" | "error";
  startTs: number;
}

export type WSServerMessage =
  | WSChunkEvent | WSToolEvent | WSUsageEvent | WSDoneEvent | WSErrorEvent | WSAttachedEvent;
