// Centralised on-disk paths. Keep these identical to the legacy server's
// values so existing user data still loads.

import { homedir } from "node:os";
import { join } from "node:path";

export const HOME = homedir();
export const CLAUDE_DIR = join(HOME, ".claude");
export const AGENTS_DIR = join(CLAUDE_DIR, "agents");
export const GLOBAL_MEMORY_PATH = join(AGENTS_DIR, "_global.memory.md");
export const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
export const SKILLS_DIR = join(AGENTS_DIR, "_skills");
export const SETTINGS_FILE = join(CLAUDE_DIR, "agent-office-settings.json");

// New persistence root (only this app writes here).
export const APP_STATE_DIR = join(CLAUDE_DIR, "agent-office");
export const RUNS_LOG = join(APP_STATE_DIR, "runs.log");
export const PROMPTS_FILE = join(APP_STATE_DIR, "recent-prompts.json");

// Uploads
export const AGENT_UPLOADS_DIR = join(AGENTS_DIR, "_uploads");
export const PROJECT_UPLOADS_ROOT = PROJECTS_DIR; // per-project: <root>/<id>/_uploads
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function agentUploadsDir(agentId: string): string {
  return join(AGENT_UPLOADS_DIR, agentId);
}

export function projectUploadsDir(projectId: string): string {
  return join(PROJECT_UPLOADS_ROOT, projectId, "_uploads");
}

export function safeFilename(name: string): string {
  return name.replace(/[/\\\0]+/g, "_").replace(/^\.+/, "").slice(0, 200) || "file";
}

export function expandTilde(p: string): string {
  return p.replace(/^~(?=\/|$)/, HOME);
}
