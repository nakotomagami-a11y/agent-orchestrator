/**
 * GitHub accounts service — registry of GitHub identities agent-office can inject
 * into a run's environment via `GH_CONFIG_DIR` (see paths.ts). Each non-default
 * account owns a config dir under GITHUB_ACCOUNTS_DIR that `gh` (and, once
 * `gh auth setup-git` has run, git-over-HTTPS) reads its token/hosts from. The
 * `default` account maps to the system gh config (`~/.config/gh`) and is NEVER
 * injected — a project on the default account inherits the machine's active gh
 * auth, identical to pre-feature behavior.
 *
 * Mirrors `accounts.ts`: pure CRUD + dir provisioning + status detection. We do
 * NOT store tokens ourselves — the USER logs in with
 * `GH_CONFIG_DIR=<dir> gh auth login`, and `getStatus` reports the resulting
 * identity by shelling out to `gh`.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { GithubAccount, GithubAccountWithStatus } from "../types/index";
import {
  GITHUB_ACCOUNTS_DIR,
  DEFAULT_GITHUB_ACCOUNT_ID,
  PROJECTS_DIR,
  buildAugmentedPath,
  githubAccountConfigDir,
  isValidIdSegment,
} from "./paths";
import { getDb } from "./db";
import { log } from "./log";

// ─── CRUD ───────────────────────────────────────────────────────────────────

interface GithubAccountRow {
  id: string;
  label: string;
  config_dir: string;
  created_at: number;
}

function rowToAccount(row: GithubAccountRow): GithubAccount {
  return { id: row.id, label: row.label, configDir: row.config_dir, createdAt: row.created_at };
}

export function list(): GithubAccount[] {
  const rows = getDb()
    .prepare("SELECT id, label, config_dir, created_at FROM github_accounts ORDER BY created_at ASC")
    .all() as GithubAccountRow[];
  return rows.map(rowToAccount);
}

export function get(id: string): GithubAccount | null {
  const row = getDb()
    .prepare("SELECT id, label, config_dir, created_at FROM github_accounts WHERE id = ?")
    .get(id) as GithubAccountRow | undefined;
  return row ? rowToAccount(row) : null;
}

export function create(input: { label: string }): GithubAccount {
  const label = input.label.trim();
  if (!label) throw new Error("label required");
  const id = `gh_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const configDir = ensureGithubAccountDir(id);
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO github_accounts (id, label, config_dir, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, label, configDir, now);
  log.info("github_account.created", { id, label });
  return { id, label, configDir, createdAt: now };
}

export function rename(id: string, label: string): GithubAccount {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("label required");
  const existing = get(id);
  if (!existing) throw new Error(`github account '${id}' not found`);
  getDb().prepare("UPDATE github_accounts SET label = ? WHERE id = ?").run(trimmed, id);
  log.info("github_account.renamed", { id, label: trimmed });
  return { ...existing, label: trimmed };
}

export interface RemoveResult {
  ok: boolean;
  blocked?: string[];
  reason?: "default" | "not_found" | "referenced";
}

export function remove(id: string): RemoveResult {
  if (id === DEFAULT_GITHUB_ACCOUNT_ID) return { ok: false, reason: "default" };
  const existing = get(id);
  if (!existing) return { ok: false, reason: "not_found" };
  const blockers = findProjectsUsingAccount(id);
  if (blockers.length > 0) return { ok: false, reason: "referenced", blocked: blockers };

  getDb().prepare("DELETE FROM github_accounts WHERE id = ?").run(id);
  // Only touch dirs under GITHUB_ACCOUNTS_DIR — never the system gh config.
  const dir = githubAccountConfigDir(id);
  if (dir && dir.startsWith(GITHUB_ACCOUNTS_DIR + "/") && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  log.info("github_account.removed", { id });
  return { ok: true };
}

// ─── Directory provisioning ──────────────────────────────────────────────────

/**
 * Idempotent. Creates `<GITHUB_ACCOUNTS_DIR>/<id>/` so the user can run
 * `GH_CONFIG_DIR=<dir> gh auth login` into it. Nothing is symlinked — a gh
 * config dir is self-contained (hosts.yml + token). The `default` account has
 * no dir under here; it maps to the system gh config.
 */
export function ensureGithubAccountDir(id: string): string {
  const dir = githubAccountConfigDir(id);
  if (!dir) throw new Error(`cannot provision a dir for the default github account`);
  if (!isValidIdSegment(id)) throw new Error(`invalid github account id: ${id}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Status detection ────────────────────────────────────────────────────────

/**
 * Report the logged-in GitHub username + ready flag for an account by running
 * `gh api user` with the account's `GH_CONFIG_DIR` in env (unset for the
 * default account, so it reads the system gh config). Handles `gh` missing /
 * not logged in gracefully → `{ ready: false }`.
 */
function readGithubLogin(configDir: string | null): string | null {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: buildAugmentedPath() };
  if (configDir) env.GH_CONFIG_DIR = configDir;
  else delete env.GH_CONFIG_DIR;
  try {
    const res = spawnSync("gh", ["api", "user", "-q", ".login"], {
      env,
      encoding: "utf-8",
      timeout: 10_000,
    });
    if (res.error || res.status !== 0) return null;
    const login = (res.stdout ?? "").trim();
    return login || null;
  } catch {
    return null;
  }
}

export function getStatus(id: string): GithubAccountWithStatus | null {
  const account = get(id);
  if (!account) return null;
  const configDir = githubAccountConfigDir(id);
  const login = readGithubLogin(configDir);
  const status: GithubAccountWithStatus = {
    ...account,
    ready: login !== null,
  };
  if (login) status.username = login;
  return status;
}

// ─── Referential integrity ──────────────────────────────────────────────────

/**
 * Scan `~/.claude/projects/*​/project.md` for any project whose YAML
 * frontmatter references the given githubAccountId. Used by `remove()` to block
 * deletion when referenced. Cheap regex parse — fail-safe: a miss lets the
 * delete through, and resolveSpawnEnv treats a stale id as "no injection".
 */
function findProjectsUsingAccount(githubAccountId: string): string[] {
  if (!existsSync(PROJECTS_DIR)) return [];
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(PROJECTS_DIR);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const projectMd = join(PROJECTS_DIR, entry, "project.md");
    if (!existsSync(projectMd)) continue;
    try {
      const raw = readFileSync(projectMd, "utf-8");
      const fm = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) continue;
      const pattern = new RegExp(`^githubAccountId:\\s*["']?${githubAccountId}["']?\\s*$`, "m");
      if (pattern.test(fm[1]!)) out.push(entry);
    } catch {
      // Unreadable — skip. Better to allow delete than block on garbled data.
    }
  }
  return out;
}
