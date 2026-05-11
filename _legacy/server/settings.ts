// App settings — persisted to ~/.claude/agent-office-settings.json.
// Absence of the file = first run.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { AppSettings, ScannedEntry } from "../shared/types";
import { log } from "./log";

const SETTINGS_FILE = join(homedir(), ".claude", "agent-office-settings.json");

export function readSettings(): AppSettings | null {
  if (!existsSync(SETTINGS_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) as Partial<AppSettings>;
    if (typeof raw.projectsRoot !== "string") return null;
    return {
      projectsRoot: raw.projectsRoot,
      excluded: Array.isArray(raw.excluded) ? raw.excluded.filter(s => typeof s === "string") : [],
      firstRunComplete: raw.firstRunComplete === true,
    };
  } catch {
    return null;
  }
}

export function writeSettings(s: AppSettings): void {
  const dir = dirname(SETTINGS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
  log.info("settings.saved", { projectsRoot: s.projectsRoot, excluded: s.excluded.length });
}

export function expandTilde(p: string): string {
  return p.replace(/^~(?=\/|$)/, homedir());
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "")
    || "project";
}

/**
 * Walk one level deep of the projects root, returning each direct subdirectory
 * as a candidate project. Hidden dirs (starting with `.`) are always omitted;
 * `excluded` names are additionally filtered (with `excluded: true` if you
 * want to see them in a preview UI).
 */
export function scanProjects(root: string, excluded: string[] = [], includeExcluded = false): ScannedEntry[] {
  const expanded = expandTilde(root);
  if (!existsSync(expanded)) return [];
  let st;
  try { st = statSync(expanded); } catch { return []; }
  if (!st.isDirectory()) return [];

  const exclusionSet = new Set(excluded);
  const entries = readdirSync(expanded, { withFileTypes: true });
  const out: ScannedEntry[] = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".")) continue;  // hidden always skipped
    const isExcluded = exclusionSet.has(e.name);
    if (isExcluded && !includeExcluded) continue;
    out.push({
      id: slugify(e.name),
      name: e.name,
      fullPath: join(expanded, e.name),
      excluded: isExcluded,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
