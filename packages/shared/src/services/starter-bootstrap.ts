// First-run starter-kit bootstrap.
//
// On a fresh install (no agents under ~/.claude/agents/, no skills under
// ~/.claude/agents/_skills/), copy a curated set of demo agents and
// skills out of the in-repo starter-data bundle into the user's
// ~/.claude tree. After the first run the user owns those files; we
// never overwrite — every check is "absent? → install" and re-runs are
// no-ops.
//
// Why this design:
//   - Keeps ~/.claude as the runtime source of truth, so the Claude Code
//     CLI and the web app keep reading the same files.
//   - Ships a populated UI for first-time users (fresh clone, Tauri
//     install, demo) without forcing anyone to author agents from
//     scratch.
//   - Idempotent: deleting an agent doesn't bring it back — that would
//     fight the user. Only an empty AGENTS_DIR (no .md files) re-seeds.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { AGENTS_DIR, SKILLS_DIR } from "./paths";

/**
 * Locate the bundled starter-data directory.
 *
 * Resolution order:
 *   1. `AGENT_OFFICE_STARTER_DATA` env var, if set — escape hatch for
 *      packaged builds (e.g. Tauri may extract resources to a known
 *      path and point us at it).
 *   2. `<cwd>/starter-data` — works for `pnpm dev` / `pnpm start` in
 *      apps/web, where Next.js sets cwd to the app dir.
 *   3. `<cwd>/apps/web/starter-data` — works when the cwd is the
 *      monorepo root.
 *
 * Returns null if no candidate exists; the caller then skips bootstrap.
 */
function resolveStarterDataDir(): string | null {
  const candidates: string[] = [];
  if (process.env["AGENT_OFFICE_STARTER_DATA"]) {
    candidates.push(process.env["AGENT_OFFICE_STARTER_DATA"]!);
  }
  candidates.push(join(process.cwd(), "starter-data"));
  candidates.push(join(process.cwd(), "apps", "web", "starter-data"));
  for (const c of candidates) {
    try {
      if (existsSync(c) && statSync(c).isDirectory()) return c;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function hasAgentMdFiles(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some(
      (f) => f.endsWith(".md") && !f.startsWith("_") && !f.endsWith(".memory.md"),
    );
  } catch {
    return false;
  }
}

function hasSkillFolders(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some(
      (name) => !name.startsWith("_") && isDir(join(dir, name)),
    );
  } catch {
    return false;
  }
}

export interface BootstrapResult {
  agentsCopied: number;
  skillsCopied: number;
  skipped: boolean;
  skippedReason?: string;
}

/**
 * Idempotent first-run install. Safe to call multiple times — the
 * second call is a no-op once anything is present.
 *
 * Agents and skills are bootstrapped independently: if the user has
 * agents but no skills, only the skills folder gets seeded, and vice
 * versa. Each individual file is also checked: an existing file is
 * never overwritten, only missing ones are written.
 */
export function bootstrapStarterDataIfNeeded(): BootstrapResult {
  const starterDir = resolveStarterDataDir();
  if (!starterDir) {
    return { agentsCopied: 0, skillsCopied: 0, skipped: true, skippedReason: "starter-data not found" };
  }

  let agentsCopied = 0;
  let skillsCopied = 0;

  const starterAgents = join(starterDir, "agents");
  if (existsSync(starterAgents) && !hasAgentMdFiles(AGENTS_DIR)) {
    mkdirSync(AGENTS_DIR, { recursive: true });
    for (const name of readdirSync(starterAgents)) {
      const from = join(starterAgents, name);
      const to = join(AGENTS_DIR, name);
      if (existsSync(to)) continue;
      cpSync(from, to);
      agentsCopied++;
    }
  }

  const starterSkills = join(starterDir, "skills");
  if (existsSync(starterSkills) && !hasSkillFolders(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
    for (const name of readdirSync(starterSkills)) {
      const from = join(starterSkills, name);
      if (!isDir(from)) continue;
      const to = join(SKILLS_DIR, name);
      if (existsSync(to)) continue;
      cpSync(from, to, { recursive: true });
      skillsCopied++;
    }
  }

  return { agentsCopied, skillsCopied, skipped: false };
}
