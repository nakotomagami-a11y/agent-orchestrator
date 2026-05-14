// Centralised on-disk paths. Keep these identical to the legacy server's
// values so existing user data still loads.

import { existsSync, readdirSync } from "node:fs";
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
export const DB_PATH = join(APP_STATE_DIR, "db.sqlite");

// Uploads
export const AGENT_UPLOADS_DIR = join(AGENTS_DIR, "_uploads");
export const PROJECT_UPLOADS_ROOT = PROJECTS_DIR; // per-project: <root>/<id>/_uploads
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Body size caps for text-payload routes (memory files, prompts).
export const MAX_MEMORY_BYTES = 256 * 1024;
export const MAX_PROMPT_BYTES = 100 * 1024;

export function agentUploadsDir(agentId: string): string {
  return join(AGENT_UPLOADS_DIR, agentId);
}

export function projectUploadsDir(projectId: string): string {
  return join(PROJECT_UPLOADS_ROOT, projectId, "_uploads");
}

export function safeFilename(name: string): string {
  return name.replace(/[/\\\0]+/g, "_").replace(/^\.+/, "").slice(0, 200) || "file";
}

// Strict validator for URL :id / :name segments that flow into path.join.
// Rejects path separators, traversal, leading dots, and oversized names —
// the route should respond 400 instead of silently transforming the value.
export function isValidIdSegment(name: string): boolean {
  if (typeof name !== "string") return false;
  if (name.length === 0 || name.length > 128) return false;
  if (name === "." || name === "..") return false;
  if (name.startsWith(".")) return false;
  return /^[A-Za-z0-9._-]+$/.test(name);
}

export function expandTilde(p: string): string {
  return p.replace(/^~(?=\/|$)/, HOME);
}

/**
 * Return an augmented PATH string that includes NVM node bin dirs and other
 * common locations so that `spawn("claude", ...)` works when the server
 * process inherits a minimal desktop-session environment (no .bashrc sourced).
 */
export function buildAugmentedPath(): string {
  const extra: string[] = [];

  // NVM — add every installed node version's bin dir (newest first via reverse sort)
  const nvmVersionsDir = join(HOME, ".nvm", "versions", "node");
  if (existsSync(nvmVersionsDir)) {
    try {
      const versions = readdirSync(nvmVersionsDir).sort().reverse();
      for (const v of versions) {
        extra.push(join(nvmVersionsDir, v, "bin"));
      }
    } catch {
      // ignore read errors
    }
  }

  // Other common global bin locations
  extra.push(join(HOME, ".local", "bin"));
  extra.push("/usr/local/bin");
  extra.push("/usr/bin");
  extra.push("/bin");

  const existing = process.env.PATH ?? "";
  const parts = [...extra, ...existing.split(":").filter(Boolean)];
  // Deduplicate while preserving order
  return [...new Set(parts)].join(":");
}
