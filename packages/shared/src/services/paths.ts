// Centralised on-disk paths. Keep these identical to the legacy server's
// values so existing user data still loads.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve as resolvePath } from "node:path";

export const HOME = homedir();
export const CLAUDE_DIR = join(HOME, ".claude");
export const AGENTS_DIR = join(CLAUDE_DIR, "agents");
export const GLOBAL_MEMORY_PATH = join(AGENTS_DIR, "_global.memory.md");
export const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
export const SKILLS_DIR = join(AGENTS_DIR, "_skills");
export const SETTINGS_FILE = join(CLAUDE_DIR, "agent-office-settings.json");

// New persistence root (only this app writes here).
export const APP_STATE_DIR = join(CLAUDE_DIR, "agent-office");
/**
 * @internal
 * Legacy path kept as a named export for backward compatibility only.
 * The one-time JSONL→SQLite migration in db.ts constructs this path locally
 * via `join(APP_STATE_DIR, "runs.log")` and does NOT import this export.
 * No active code imports this symbol.
 */
export const RUNS_LOG = join(APP_STATE_DIR, "runs.log");
/**
 * @internal
 * Legacy path kept as a named export for backward compatibility only.
 * The one-time JSONL→SQLite migration in db.ts constructs this path locally
 * via `join(APP_STATE_DIR, "recent-prompts.json")` and does NOT import this export.
 * No active code imports this symbol.
 */
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
// Rejects path separators, traversal, leading dots, and oversized names -
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

  // NVM - add every installed node version's bin dir (newest first via reverse sort)
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

  if (process.platform === "win32") {
    // Common Windows locations where the Claude CLI lands when installed via npm.
    extra.push(join(process.env.APPDATA ?? join(HOME, "AppData", "Roaming"), "npm"));
    extra.push(join(HOME, "AppData", "Local", "npm"));
  } else {
    extra.push(join(HOME, ".local", "bin"));
    extra.push("/usr/local/bin");
    extra.push("/usr/bin");
    extra.push("/bin");
  }

  const existing = process.env.PATH ?? "";
  const parts = [...extra, ...existing.split(delimiter).filter(Boolean)];
  // Deduplicate while preserving order
  return [...new Set(parts)].join(delimiter);
}

// Resolve the actual Claude CLI binary path. Node's spawn() on Windows won't
// pick up `claude.cmd` from a bare "claude" name — we need either shell:true
// (which is unsafe with user-supplied prompt args) or the full path. Cache it.
let cachedClaudeCommand: string | null = null;
export function resolveClaudeCommand(): string {
  if (process.platform !== "win32") return "claude";
  if (cachedClaudeCommand) return cachedClaudeCommand;
  try {
    // timeout: protect against a stalled `where` if PATH contains a slow
    // network share — it would otherwise block the Node event loop.
    const out = execSync("where claude", {
      encoding: "utf8",
      timeout: 3_000,
      env: { ...process.env, PATH: buildAugmentedPath() },
    });
    const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Prefer .exe if present in PATH — it's a real executable and Node's
    // spawn() can launch it directly without shell:true. Using .cmd would
    // force shell:true, and cmd.exe quoting mangles multi-line arguments
    // like --append-system-prompt (newlines/specials get treated as arg
    // boundaries), which corrupts the prompt sent to claude.
    let pick = lines.find((l) => l.toLowerCase().endsWith(".exe"));

    // If no .exe in PATH, try to extract the real .exe path from the .cmd
    // shim — npm's global shim is a thin batch wrapper that calls the
    // underlying .exe out of node_modules.
    if (!pick) {
      const cmdPath = lines.find((l) => l.toLowerCase().endsWith(".cmd"));
      if (cmdPath) {
        const real = readExeFromCmdShim(cmdPath);
        if (real && existsSync(real)) pick = real;
        else pick = cmdPath; // fall back to the .cmd shim
      }
    }

    pick = pick ?? lines[0];
    if (pick) cachedClaudeCommand = pick;
  } catch {
    // ignore — fall through
  }
  return cachedClaudeCommand ?? "claude";
}

function readExeFromCmdShim(cmdPath: string): string | null {
  try {
    const content = readFileSync(cmdPath, "utf8");
    // Match the .exe path that the shim invokes, e.g.:
    //   "%dp0%\node_modules\...\bin\claude.exe"  %*
    const m = content.match(/"([^"\r\n]+\.exe)"\s+%\*/i);
    if (!m) return null;
    // Replace whichever batch %dp0 variant the shim used — covers all four
    // forms (%dp0%, %~dp0, %~dp0%, %dp0) so we work with shims emitted by
    // modern npm (cmd-shim with `SET dp0=%~dp0`), yarn, older npm, and
    // pnpm polyfills alike.
    const raw = m[1]!.replace(/%~?dp0%?\\?/i, dirname(cmdPath) + "\\");
    return resolvePath(raw);
  } catch {
    return null;
  }
}
