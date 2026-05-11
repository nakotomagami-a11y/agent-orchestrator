/**
 * Node-only side of the instrumentation hook. Imported dynamically
 * from instrumentation.ts under the nodejs runtime guard, so the edge
 * bundle never has to compile this file — the fs and os imports
 * below would fail there otherwise.
 *
 * Installs the bundled starter-kit (curated agents + skills) into
 * `~/.claude/` on a fresh machine so the UI lands populated. Each
 * directory is checked independently and existing user data is never
 * overwritten — subsequent restarts are no-ops.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE_DIR = join(homedir(), ".claude");
const AGENTS_DIR = join(CLAUDE_DIR, "agents");
const SKILLS_DIR = join(AGENTS_DIR, "_skills");

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

try {
  const starterDir = resolveStarterDataDir();
  if (starterDir) {
    let agents = 0;
    let skills = 0;

    const starterAgents = join(starterDir, "agents");
    if (existsSync(starterAgents) && !hasAgentMdFiles(AGENTS_DIR)) {
      mkdirSync(AGENTS_DIR, { recursive: true });
      for (const name of readdirSync(starterAgents)) {
        const from = join(starterAgents, name);
        const to = join(AGENTS_DIR, name);
        if (existsSync(to)) continue;
        cpSync(from, to);
        agents++;
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
        skills++;
      }
    }

    if (agents > 0 || skills > 0) {
      // eslint-disable-next-line no-console
      console.log(`[starter-bootstrap] seeded ${agents} agent(s), ${skills} skill(s)`);
    }
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn("[starter-bootstrap] skipped:", err);
}
