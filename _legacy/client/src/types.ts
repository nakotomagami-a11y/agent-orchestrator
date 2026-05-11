// Frontend-specific types. API/shared types live in shared/types.ts.

import type { AgentStatus, ApiAgent } from "../../shared/types";

export type {
  AgentStatus, ApiAgent, PersistedRun, HealthInfo, AgentBody,
  RegistrySkill, InstalledSkill, SkillUpdate, SkillProvenance,
  Project, ProjectMeta, ProjectSummary, AgentInstance,
  AppSettings, ScannedEntry,
} from "../../shared/types";

export interface Agent {
  id: string;
  name: string;
  glyph: string;
  desc: string;
  skills: string[];
  tools: string[];
  model: string;
  effort: string;
  status: AgentStatus;
  pm: string;
  room?: string;
}

export type RunStatus = "running" | "done" | "error";

// Streaming output is a list of segments so we can render tool calls as styled blocks
export interface OutputSegment {
  kind: "text" | "tool";
  text?: string;       // for kind:"text"
  toolName?: string;   // for kind:"tool"
  toolInput?: unknown; // for kind:"tool"
}

export interface Run {
  id: string;
  agentId: string;
  agentName: string;
  ts: number;
  prompt: string;
  status: RunStatus;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  durMs?: number;
  elapsedStr?: string;
  model: string;
  effort: string;
  segments: OutputSegment[];
  cwd?: string;
  projectId?: string;
  instanceId?: string;
}

export function agentFromApi(a: ApiAgent, status: AgentStatus = "idle"): Agent {
  return {
    id: a.name,
    name: a.name.charAt(0).toUpperCase() + a.name.slice(1),
    glyph: "◯",
    desc: a.description,
    skills: a.skills,
    tools: a.tools,
    model: a.defaultModel ?? "sonnet",
    effort: a.defaultEffort ?? "medium",
    pm: a.permissionMode ?? "ask",
    room: a.room,
    status,
  };
}
