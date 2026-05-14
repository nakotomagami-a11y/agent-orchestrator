import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DB_PATH, APP_STATE_DIR, AGENTS_DIR } from "./paths";
import type { PersistedRun } from "../types/index";

declare global {
  // eslint-disable-next-line no-var
  var __agentOfficeDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (globalThis.__agentOfficeDb) return globalThis.__agentOfficeDb;
  if (!existsSync(APP_STATE_DIR)) mkdirSync(APP_STATE_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  createSchema(db);
  migrateFromJsonl(db);
  // Any run still "running" at open time is orphaned from a previous crash/kill.
  db.prepare("UPDATE runs SET status='error', exit_code=-1, ended_at=? WHERE status='running'").run(Date.now());
  globalThis.__agentOfficeDb = db;
  return db;
}

function createSchema(db: Database.Database): void {
  const current = (db.pragma("user_version", { simple: true }) as number) ?? 0;

  if (current === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        instance_id TEXT NOT NULL DEFAULT 'default',
        instance_label TEXT,
        project_id TEXT,
        session_id TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        exit_code INTEGER,
        prompt TEXT NOT NULL,
        output TEXT NOT NULL DEFAULT '',
        tokens_in INTEGER NOT NULL DEFAULT 0,
        tokens_out INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        dur_ms INTEGER,
        model TEXT NOT NULL DEFAULT '',
        effort TEXT NOT NULL DEFAULT '',
        cwd TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        agent_id TEXT NOT NULL,
        instance_id TEXT NOT NULL DEFAULT 'default',
        role TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content TEXT NOT NULL,
        ts INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        name TEXT NOT NULL,
        input TEXT,
        ts INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recent_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        used_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transcripts (
        agent_id TEXT NOT NULL,
        instance_id TEXT NOT NULL DEFAULT 'default',
        items TEXT NOT NULL DEFAULT '[]',
        active_run_id TEXT,
        session_id TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(agent_id, instance_id)
      );

      CREATE TABLE IF NOT EXISTS drafts (
        agent_id TEXT NOT NULL,
        instance_id TEXT NOT NULL DEFAULT 'default',
        text TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(agent_id, instance_id)
      );

      CREATE TABLE IF NOT EXISTS ui_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content, content=messages, content_rowid=rowid
      );

      CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_runs_instance ON runs(agent_id, instance_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_run ON messages(run_id);
      CREATE INDEX IF NOT EXISTS idx_messages_ai ON messages(agent_id, instance_id, ts DESC);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id);
      CREATE INDEX IF NOT EXISTS idx_prompts_agent ON recent_prompts(agent_id, used_at DESC);

      CREATE TRIGGER IF NOT EXISTS messages_ai_fts AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_ad_fts AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_au_fts AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
        INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
    `);
    db.pragma("user_version = 1");
  }
}

// ─── One-time JSONL → SQLite migration ───────────────────────────────────────

function migrateFromJsonl(db: Database.Database): void {
  const already = db.prepare("SELECT value FROM ui_settings WHERE key = '_migrated'").get() as { value: string } | undefined;
  if (already) return;

  // Migrate runs.log
  const RUNS_LOG = join(APP_STATE_DIR, "runs.log");
  const LEGACY_RUNS_LOG = join(AGENTS_DIR, "_runs.log");
  const insertRun = db.prepare(`
    INSERT OR IGNORE INTO runs (id, agent_id, agent_name, instance_id, instance_label, project_id, session_id, status, exit_code, prompt, output, tokens_in, tokens_out, cost_usd, dur_ms, model, effort, cwd, started_at, ended_at)
    VALUES (@id, @agent_id, @agent_name, @instance_id, @instance_label, @project_id, @session_id, @status, @exit_code, @prompt, @output, @tokens_in, @tokens_out, @cost_usd, @dur_ms, @model, @effort, @cwd, @started_at, @ended_at)
  `);

  const migrateRunsFile = db.transaction((path: string) => {
    if (!existsSync(path)) return;
    try {
      const raw = readFileSync(path, "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const r = JSON.parse(line) as PersistedRun;
          insertRun.run({
            id: r.id, agent_id: r.agentId, agent_name: r.agentName,
            instance_id: r.instanceId ?? "default", instance_label: r.instanceLabel ?? null,
            project_id: r.projectId ?? null, session_id: r.sessionId ?? null,
            status: r.status, exit_code: r.exitCode ?? null,
            prompt: r.prompt, output: r.output,
            tokens_in: r.tokensIn, tokens_out: r.tokensOut, cost_usd: r.cost,
            dur_ms: r.durMs, model: r.model, effort: r.effort,
            cwd: r.cwd ?? null, started_at: r.ts, ended_at: r.ts + r.durMs,
          });
        } catch { /* skip malformed */ }
      }
    } catch { /* skip unreadable */ }
  });

  migrateRunsFile(RUNS_LOG);
  migrateRunsFile(LEGACY_RUNS_LOG);

  // Migrate history JSONL files
  const HISTORY_DIR = join(APP_STATE_DIR, "history");
  const insertMsg = db.prepare(`
    INSERT OR IGNORE INTO messages (id, run_id, agent_id, instance_id, role, content, ts)
    VALUES (@id, @run_id, @agent_id, @instance_id, @role, @content, @ts)
  `);
  // Ensure the run exists for the FK (history messages may reference runs not in the log)
  const ensureRun = db.prepare(`
    INSERT OR IGNORE INTO runs (id, agent_id, agent_name, prompt, status, output, started_at)
    VALUES (@id, @agent_id, @agent_name, '', 'done', '', @started_at)
  `);

  if (existsSync(HISTORY_DIR)) {
    try {
      const files = readdirSync(HISTORY_DIR).filter(f => f.endsWith(".jsonl"));
      const migrateHistory = db.transaction(() => {
        for (const file of files) {
          const key = file.replace(/\.jsonl$/, "");
          const parts = key.split("::");
          const agentId = parts[0] ?? key;
          const instanceId = parts.slice(1).join("::") || "default";
          try {
            const raw = readFileSync(join(HISTORY_DIR, file), "utf8");
            for (const line of raw.split("\n")) {
              if (!line.trim()) continue;
              try {
                const m = JSON.parse(line) as { role: string; content: string; runId: string; ts: number };
                ensureRun.run({ id: m.runId, agent_id: agentId, agent_name: agentId, started_at: m.ts });
                insertMsg.run({
                  id: randomUUID(), run_id: m.runId,
                  agent_id: agentId, instance_id: instanceId,
                  role: m.role, content: m.content, ts: m.ts,
                });
              } catch { /* skip */ }
            }
          } catch { /* skip */ }
        }
      });
      migrateHistory();
    } catch { /* skip */ }
  }

  // Migrate recent prompts JSON
  const PROMPTS_FILE = join(APP_STATE_DIR, "recent-prompts.json");
  const LEGACY_PROMPTS = join(AGENTS_DIR, "_recent_prompts.json");
  const insertPrompt = db.prepare(`
    INSERT INTO recent_prompts (agent_id, prompt, used_at) VALUES (?, ?, ?)
  `);
  const migratePrompts = db.transaction((path: string) => {
    if (!existsSync(path)) return;
    try {
      const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, string[]>;
      for (const [agentId, prompts] of Object.entries(data)) {
        for (const prompt of prompts) {
          try { insertPrompt.run(agentId, prompt, Date.now()); } catch { /* skip dup */ }
        }
      }
    } catch { /* skip */ }
  });
  migratePrompts(PROMPTS_FILE);
  migratePrompts(LEGACY_PROMPTS);

  // Mark migration done
  db.prepare("INSERT OR REPLACE INTO ui_settings (key, value, updated_at) VALUES ('_migrated', '1', ?)").run(Date.now());
}

// ─── Run operations ────────────────────────────────────────────────────────────

export interface RunInsert {
  id: string; agentId: string; agentName: string;
  instanceId?: string; instanceLabel?: string; projectId?: string;
  sessionId?: string; status: string; prompt: string;
  model: string; effort: string; cwd?: string; startedAt: number;
}

export function insertRun(r: RunInsert): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO runs (id, agent_id, agent_name, instance_id, instance_label, project_id, session_id, status, prompt, output, model, effort, cwd, started_at)
    VALUES (@id, @agentId, @agentName, @instanceId, @instanceLabel, @projectId, @sessionId, @status, @prompt, '', @model, @effort, @cwd, @startedAt)
  `).run({ ...r, instanceId: r.instanceId ?? "default", instanceLabel: r.instanceLabel ?? null, projectId: r.projectId ?? null, sessionId: r.sessionId ?? null, cwd: r.cwd ?? null });
}

export interface RunUpdate {
  status: string; exitCode?: number; output: string;
  tokensIn: number; tokensOut: number; costUsd: number;
  durMs: number; sessionId?: string; endedAt: number;
}

export function updateRun(id: string, u: RunUpdate): void {
  getDb().prepare(`
    UPDATE runs SET status=@status, exit_code=@exitCode, output=@output,
      tokens_in=@tokensIn, tokens_out=@tokensOut, cost_usd=@costUsd,
      dur_ms=@durMs, session_id=@sessionId, ended_at=@endedAt
    WHERE id=@id
  `).run({ id, ...u, exitCode: u.exitCode ?? null, sessionId: u.sessionId ?? null });
}

export function markRunAborted(id: string): void {
  getDb().prepare(
    "UPDATE runs SET status='error', exit_code=-1, ended_at=? WHERE id=? AND status='running'"
  ).run(Date.now(), id);
}

interface RunRow {
  id: string; agent_id: string; agent_name: string; instance_id: string;
  instance_label: string | null; project_id: string | null; session_id: string | null;
  status: string; exit_code: number | null; prompt: string; output: string;
  tokens_in: number; tokens_out: number; cost_usd: number; dur_ms: number | null;
  model: string; effort: string; cwd: string | null; started_at: number; ended_at: number | null;
}

function rowToRun(row: RunRow): PersistedRun {
  return {
    id: row.id, agentId: row.agent_id, agentName: row.agent_name,
    instanceId: row.instance_id === "default" ? undefined : row.instance_id,
    instanceLabel: row.instance_label ?? undefined,
    projectId: row.project_id ?? undefined, sessionId: row.session_id ?? undefined,
    status: row.status as "running" | "done" | "error",
    exitCode: row.exit_code ?? undefined, prompt: row.prompt, output: row.output,
    tokensIn: row.tokens_in, tokensOut: row.tokens_out, cost: row.cost_usd,
    durMs: row.dur_ms ?? 0, model: row.model, effort: row.effort,
    cwd: row.cwd ?? undefined, ts: row.started_at,
  };
}

export interface ListRunsOpts {
  agentId?: string; projectId?: string; instanceId?: string; limit?: number;
}

export function listRuns(opts: ListRunsOpts = {}): PersistedRun[] {
  const { agentId, projectId, instanceId, limit = 200 } = opts;
  const conditions: string[] = [];
  const params: Record<string, unknown> = { limit };
  if (agentId) { conditions.push("agent_id = @agentId"); params.agentId = agentId; }
  if (projectId) { conditions.push("project_id = @projectId"); params.projectId = projectId; }
  if (instanceId) { conditions.push("instance_id = @instanceId"); params.instanceId = instanceId; }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const rows = getDb().prepare(`SELECT * FROM runs ${where} ORDER BY started_at DESC LIMIT @limit`).all(params) as RunRow[];
  return rows.map(rowToRun);
}

export function getRun(id: string): PersistedRun | null {
  const row = getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function deleteRunsForInstance(projectId: string, instanceId: string): number {
  const result = getDb().prepare(
    "DELETE FROM runs WHERE project_id = ? AND instance_id = ?"
  ).run(projectId, instanceId);
  return result.changes;
}

export function deleteRunsByAgent(agentId: string): number {
  const result = getDb().prepare("DELETE FROM runs WHERE agent_id = ?").run(agentId);
  return result.changes;
}

// ─── Message operations ────────────────────────────────────────────────────────

const MAX_USER_CONTENT = 2_000;
const MAX_ASSISTANT_CONTENT = 8_000;

export function insertMessages(opts: {
  runId: string; agentId: string; instanceId: string;
  userContent: string; assistantContent: string; ts: number;
}): void {
  if (!opts.assistantContent.trim()) return;
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO messages (id, run_id, agent_id, instance_id, role, content, ts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    insert.run(randomUUID(), opts.runId, opts.agentId, opts.instanceId, "user",
      opts.userContent.slice(0, MAX_USER_CONTENT), opts.ts);
    insert.run(randomUUID(), opts.runId, opts.agentId, opts.instanceId, "assistant",
      opts.assistantContent.slice(0, MAX_ASSISTANT_CONTENT), Date.now());
  })();
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  runId: string;
  ts: number;
}

export function getRecentMessages(agentId: string, instanceId: string, limit = 8): HistoryMessage[] {
  const rows = getDb().prepare(`
    SELECT role, content, run_id, ts FROM messages
    WHERE agent_id = ? AND instance_id = ?
    ORDER BY ts DESC LIMIT ?
  `).all(agentId, instanceId, limit) as Array<{ role: string; content: string; run_id: string; ts: number }>;
  return rows.reverse().map(r => ({ role: r.role as "user" | "assistant", content: r.content, runId: r.run_id, ts: r.ts }));
}

export function searchMessages(query: string, limit = 50): Array<HistoryMessage & { agentId: string; instanceId: string }> {
  const rows = getDb().prepare(`
    SELECT m.role, m.content, m.run_id, m.ts, m.agent_id, m.instance_id
    FROM messages_fts f JOIN messages m ON f.rowid = m.rowid
    WHERE messages_fts MATCH ? ORDER BY rank LIMIT ?
  `).all(query, limit) as Array<{ role: string; content: string; run_id: string; ts: number; agent_id: string; instance_id: string }>;
  return rows.map(r => ({
    role: r.role as "user" | "assistant", content: r.content,
    runId: r.run_id, ts: r.ts, agentId: r.agent_id, instanceId: r.instance_id,
  }));
}

// ─── Tool calls ────────────────────────────────────────────────────────────────

export function insertToolCall(runId: string, name: string, input: unknown, ts: number): void {
  try {
    getDb().prepare(
      "INSERT INTO tool_calls (id, run_id, name, input, ts) VALUES (?, ?, ?, ?, ?)"
    ).run(randomUUID(), runId, name, JSON.stringify(input), ts);
  } catch { /* best-effort */ }
}

// ─── Recent prompts ────────────────────────────────────────────────────────────

const MAX_RECENT_PROMPTS = 10;

export function getRecentPrompts(agentId: string): string[] {
  const rows = getDb().prepare(
    "SELECT prompt FROM recent_prompts WHERE agent_id = ? ORDER BY used_at DESC LIMIT ?"
  ).all(agentId, MAX_RECENT_PROMPTS) as Array<{ prompt: string }>;
  return rows.map(r => r.prompt);
}

export function pushRecentPrompt(agentId: string, prompt: string): void {
  if (!prompt.trim()) return;
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM recent_prompts WHERE agent_id = ? AND prompt = ?").run(agentId, prompt);
    db.prepare("INSERT INTO recent_prompts (agent_id, prompt, used_at) VALUES (?, ?, ?)").run(agentId, prompt, Date.now());
    // Keep only most recent 10
    const ids = db.prepare(
      "SELECT id FROM recent_prompts WHERE agent_id = ? ORDER BY used_at DESC LIMIT -1 OFFSET ?"
    ).all(agentId, MAX_RECENT_PROMPTS) as Array<{ id: number }>;
    if (ids.length > 0) {
      db.prepare(`DELETE FROM recent_prompts WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids.map(r => r.id));
    }
  })();
}

export function getAllRecentPrompts(): Record<string, string[]> {
  const rows = getDb().prepare(
    "SELECT agent_id, prompt FROM recent_prompts ORDER BY agent_id, used_at DESC"
  ).all() as Array<{ agent_id: string; prompt: string }>;
  const out: Record<string, string[]> = {};
  for (const { agent_id, prompt } of rows) {
    if (!out[agent_id]) out[agent_id] = [];
    out[agent_id]!.push(prompt);
  }
  return out;
}

// ─── Transcripts ────────────────────────────────────────────────────────────────

export interface TranscriptRow {
  items: string;
  activeRunId: string | null;
  sessionId: string | null;
  updatedAt: number;
}

export function getTranscript(agentId: string, instanceId: string): TranscriptRow | null {
  const row = getDb().prepare(
    "SELECT items, active_run_id, session_id, updated_at FROM transcripts WHERE agent_id = ? AND instance_id = ?"
  ).get(agentId, instanceId) as { items: string; active_run_id: string | null; session_id: string | null; updated_at: number } | undefined;
  if (!row) return null;
  return { items: row.items, activeRunId: row.active_run_id, sessionId: row.session_id, updatedAt: row.updated_at };
}

export function saveTranscript(agentId: string, instanceId: string, items: string, activeRunId: string | null, sessionId: string | null): void {
  getDb().prepare(`
    INSERT INTO transcripts (agent_id, instance_id, items, active_run_id, session_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, instance_id) DO UPDATE SET
      items=excluded.items, active_run_id=excluded.active_run_id,
      session_id=excluded.session_id, updated_at=excluded.updated_at
  `).run(agentId, instanceId, items, activeRunId, sessionId, Date.now());
}

export function clearTranscript(agentId: string, instanceId: string): void {
  getDb().prepare("DELETE FROM transcripts WHERE agent_id = ? AND instance_id = ?").run(agentId, instanceId);
}

export function listAgentTranscripts(agentId: string): Array<{ instanceId: string; sessionId: string | null; updatedAt: number }> {
  const rows = getDb().prepare(
    "SELECT instance_id, session_id, updated_at FROM transcripts WHERE agent_id = ? ORDER BY updated_at DESC"
  ).all(agentId) as Array<{ instance_id: string; session_id: string | null; updated_at: number }>;
  return rows.map(r => ({ instanceId: r.instance_id, sessionId: r.session_id, updatedAt: r.updated_at }));
}

// ─── Drafts ────────────────────────────────────────────────────────────────────

export function getDraft(agentId: string, instanceId: string): string {
  const row = getDb().prepare(
    "SELECT text FROM drafts WHERE agent_id = ? AND instance_id = ?"
  ).get(agentId, instanceId) as { text: string } | undefined;
  return row?.text ?? "";
}

export function saveDraft(agentId: string, instanceId: string, text: string): void {
  if (text) {
    getDb().prepare(`
      INSERT INTO drafts (agent_id, instance_id, text, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id, instance_id) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at
    `).run(agentId, instanceId, text, Date.now());
  } else {
    clearDraft(agentId, instanceId);
  }
}

export function clearDraft(agentId: string, instanceId: string): void {
  getDb().prepare("DELETE FROM drafts WHERE agent_id = ? AND instance_id = ?").run(agentId, instanceId);
}

// ─── UI settings ────────────────────────────────────────────────────────────────

export function getUiSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM ui_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setUiSetting(key: string, value: string): void {
  getDb().prepare(`
    INSERT INTO ui_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(key, value, Date.now());
}

export function getAllUiSettings(): Record<string, string> {
  const rows = getDb().prepare("SELECT key, value FROM ui_settings WHERE key NOT LIKE '\\_%' ESCAPE '\\'").all() as Array<{ key: string; value: string }>;
  const out: Record<string, string> = {};
  for (const { key, value } of rows) out[key] = value;
  return out;
}
