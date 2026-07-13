import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DB_PATH, APP_STATE_DIR, AGENTS_DIR } from "./paths";
import type { PersistedRun, PipelineRun, PipelineRunStep, Workflow } from "../types/index";
import { STARTER_WORKFLOWS, STARTER_WORKFLOW_CATEGORY } from "./workflow-seed";

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
  const now = Date.now();
  db.prepare(
    "UPDATE runs SET status='error', exit_code=-1, ended_at=@now, dur_ms=MAX(0, @now-started_at) WHERE status='running'"
  ).run({ now });
  // Any pipeline still running was interrupted by the restart - mark it so the UI can surface a recovery banner.
  db.prepare("UPDATE pipelines SET status='error', ended_at=@now, interrupted=1 WHERE status='running'").run({ now });
  globalThis.__agentOfficeDb = db;
  return db;
}

const MIGRATIONS: Array<(db: Database.Database) => void> = [
  // v0 → v1: initial schema
  (db) => {
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
  },
  // v1 → v2: pipelines tables
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        created_at INTEGER NOT NULL,
        ended_at INTEGER,
        interrupted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS pipeline_steps (
        pipeline_id TEXT NOT NULL REFERENCES pipelines(id),
        step_index INTEGER NOT NULL,
        parallel_group INTEGER,
        agent_id TEXT NOT NULL,
        run_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        output TEXT,
        exit_code INTEGER,
        PRIMARY KEY(pipeline_id, step_index)
      );

      CREATE INDEX IF NOT EXISTS idx_pipeline_steps_pipeline ON pipeline_steps(pipeline_id);
      CREATE INDEX IF NOT EXISTS idx_pipelines_project ON pipelines(project_id, created_at DESC);
    `);
  },
  // v2 → v3: index on started_at for unfiltered quota queries
  (db) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs (started_at DESC);
    `);
  },
  // v3 → v4: parent_run_id for sub-agent tracking
  (db) => {
    db.exec(`
      ALTER TABLE runs ADD COLUMN parent_run_id TEXT REFERENCES runs(id);
      CREATE INDEX IF NOT EXISTS idx_runs_parent ON runs (parent_run_id);
    `);
  },
  // v4 → v5: saved_prompts global prompt library
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS saved_prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        created_at INTEGER NOT NULL,
        use_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_saved_prompts_category ON saved_prompts(category);
      CREATE INDEX IF NOT EXISTS idx_saved_prompts_created ON saved_prompts(created_at DESC);
    `);
  },
  // v5 → v6: per-transcript queued-message backlog. Messages typed while a
  // run is in flight used to live in `useState` on the chat panel, so a reload
  // or app crash dropped them silently. Stored as a JSON array of
  // `{ id, text }` so a schema change isn't needed if the shape grows.
  (db) => {
    db.exec(`
      ALTER TABLE transcripts ADD COLUMN queued_messages TEXT NOT NULL DEFAULT '[]';
    `);
  },
  // v6 → v7: workflows rebrand. Old free-form saved prompts are noise; the
  // starter set is a small, curated library of reusable multi-step prompts.
  // We keep the underlying table name `saved_prompts` (renaming risks live
  // data), wipe all legacy rows, and seed the starter workflows in a
  // dedicated `starter` category. User-created workflows added later will
  // sit alongside these in other categories.
  (db) => {
    db.exec(`DELETE FROM saved_prompts;`);
    const insert = db.prepare(
      "INSERT INTO saved_prompts (id, title, body, category, created_at, use_count) VALUES (?, ?, ?, ?, ?, 0)",
    );
    const now = Date.now();
    for (const w of STARTER_WORKFLOWS) {
      insert.run(randomUUID(), w.title, w.body, STARTER_WORKFLOW_CATEGORY, now);
    }
  },
];

function createSchema(db: Database.Database): void {
  const current = (db.pragma("user_version", { simple: true }) as number) ?? 0;
  db.transaction(() => {
    let v = current;
    if (v < 1) { MIGRATIONS[0]!(db); v = 1; db.pragma("user_version = 1"); }
    if (v < 2) { MIGRATIONS[1]!(db); v = 2; db.pragma("user_version = 2"); }
    if (v < 3) { MIGRATIONS[2]!(db); v = 3; db.pragma("user_version = 3"); }
    if (v < 4) { MIGRATIONS[3]!(db); v = 4; db.pragma("user_version = 4"); }
    if (v < 5) { MIGRATIONS[4]!(db); v = 5; db.pragma("user_version = 5"); }
    if (v < 6) { MIGRATIONS[5]!(db); v = 6; db.pragma("user_version = 6"); }
    if (v < 7) { MIGRATIONS[6]!(db); v = 7; db.pragma("user_version = 7"); }
  })();
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
  parentRunId?: string;
}

export function insertRun(r: RunInsert): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO runs (id, agent_id, agent_name, instance_id, instance_label, project_id, session_id, status, prompt, output, model, effort, cwd, started_at, parent_run_id)
    VALUES (@id, @agentId, @agentName, @instanceId, @instanceLabel, @projectId, @sessionId, @status, @prompt, '', @model, @effort, @cwd, @startedAt, @parentRunId)
  `).run({ ...r, instanceId: r.instanceId ?? "default", instanceLabel: r.instanceLabel ?? null, projectId: r.projectId ?? null, sessionId: r.sessionId ?? null, cwd: r.cwd ?? null, parentRunId: r.parentRunId ?? null });
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
  const now = Date.now();
  getDb().prepare(
    "UPDATE runs SET status='error', exit_code=-1, ended_at=@now, dur_ms=MAX(0, @now-started_at) WHERE id=@id AND status='running'"
  ).run({ now, id });
}

interface RunRow {
  id: string; agent_id: string; agent_name: string; instance_id: string;
  instance_label: string | null; project_id: string | null; session_id: string | null;
  status: string; exit_code: number | null; prompt: string; output: string;
  tokens_in: number; tokens_out: number; cost_usd: number; dur_ms: number | null;
  model: string; effort: string; cwd: string | null; started_at: number; ended_at: number | null;
  parent_run_id: string | null;
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
    durMs: row.dur_ms ?? (row.ended_at != null ? row.ended_at - row.started_at : 0), model: row.model, effort: row.effort,
    cwd: row.cwd ?? undefined, ts: row.started_at,
    parentRunId: row.parent_run_id ?? undefined,
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

export function getSumCostSince(sinceTimestamp: number): number {
  const row = getDb().prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) as total FROM runs WHERE started_at >= ?"
  ).get(sinceTimestamp) as { total: number };
  return row.total;
}

export function getSpendForInstance(agentId: string, instanceId: string): number {
  const row = getDb().prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) as total FROM runs WHERE agent_id = ? AND instance_id = ?"
  ).get(agentId, instanceId) as { total: number };
  return row.total;
}

export function getSpendByInstanceForProject(projectId: string): Record<string, number> {
  const rows = getDb().prepare(
    "SELECT agent_id, instance_id, COALESCE(SUM(cost_usd), 0) as total FROM runs WHERE project_id = ? GROUP BY agent_id, instance_id"
  ).all(projectId) as Array<{ agent_id: string; instance_id: string; total: number }>;
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[`${row.agent_id}|${row.instance_id}`] = row.total;
  }
  return out;
}

export function getRun(id: string): PersistedRun | null {
  const row = getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function getChildRuns(parentRunId: string): PersistedRun[] {
  const rows = getDb().prepare(
    "SELECT * FROM runs WHERE parent_run_id = ? ORDER BY started_at ASC"
  ).all(parentRunId) as RunRow[];
  return rows.map(rowToRun);
}

export function deleteRunsForInstance(projectId: string, instanceId: string): number {
  const db = getDb();
  const runIds = (db.prepare("SELECT id FROM runs WHERE project_id = ? AND instance_id = ?").all(projectId, instanceId) as { id: string }[]).map(r => r.id);
  if (runIds.length === 0) return 0;
  const placeholders = runIds.map(() => "?").join(",");
  const deleteToolCalls = db.prepare(`DELETE FROM tool_calls WHERE run_id IN (${placeholders})`);
  const deleteMessages = db.prepare(`DELETE FROM messages WHERE run_id IN (${placeholders})`);
  const deleteRuns = db.prepare("DELETE FROM runs WHERE project_id = ? AND instance_id = ?");
  let changes = 0;
  db.transaction(() => {
    deleteToolCalls.run(...runIds);
    deleteMessages.run(...runIds);
    changes = deleteRuns.run(projectId, instanceId).changes;
  })();
  return changes;
}

export function deleteRunsByAgent(agentId: string): number {
  const db = getDb();
  let changes = 0;
  db.transaction(() => {
    db.prepare("DELETE FROM tool_calls WHERE run_id IN (SELECT id FROM runs WHERE agent_id = ?)").run(agentId);
    db.prepare("DELETE FROM messages WHERE agent_id = ?").run(agentId);
    changes = db.prepare("DELETE FROM runs WHERE agent_id = ?").run(agentId).changes;
  })();
  return changes;
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

export function searchMessagesForAgent(agentId: string, instanceId: string, ftsQuery: string, limit = 10): HistoryMessage[] {
  try {
    const rows = getDb().prepare(`
      SELECT m.role, m.content, m.run_id, m.ts
      FROM messages_fts f JOIN messages m ON f.rowid = m.rowid
      WHERE messages_fts MATCH ? AND m.agent_id = ? AND m.instance_id = ?
      ORDER BY rank LIMIT ?
    `).all(ftsQuery, agentId, instanceId, limit) as Array<{ role: string; content: string; run_id: string; ts: number }>;
    return rows.map(r => ({ role: r.role as "user" | "assistant", content: r.content, runId: r.run_id, ts: r.ts }));
  } catch {
    return [];
  }
}

export function getRecentMessagesByProject(agentId: string, projectId: string, limit = 8): HistoryMessage[] {
  const rows = getDb().prepare(`
    SELECT m.role, m.content, m.run_id, m.ts
    FROM messages m JOIN runs r ON m.run_id = r.id
    WHERE m.agent_id = ? AND r.project_id = ?
    ORDER BY m.ts DESC LIMIT ?
  `).all(agentId, projectId, limit) as Array<{ role: string; content: string; run_id: string; ts: number }>;
  return rows.reverse().map(r => ({ role: r.role as "user" | "assistant", content: r.content, runId: r.run_id, ts: r.ts }));
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
  /** JSON-encoded `Array<{ id: string; text: string }>`. Empty array = none. */
  queuedMessages: string;
  updatedAt: number;
}

export function getTranscript(agentId: string, instanceId: string): TranscriptRow | null {
  const row = getDb().prepare(
    "SELECT items, active_run_id, session_id, queued_messages, updated_at FROM transcripts WHERE agent_id = ? AND instance_id = ?"
  ).get(agentId, instanceId) as {
    items: string;
    active_run_id: string | null;
    session_id: string | null;
    queued_messages: string | null;
    updated_at: number;
  } | undefined;
  if (!row) return null;
  return {
    items: row.items,
    activeRunId: row.active_run_id,
    sessionId: row.session_id,
    queuedMessages: row.queued_messages ?? "[]",
    updatedAt: row.updated_at,
  };
}

export function saveTranscript(
  agentId: string,
  instanceId: string,
  items: string,
  activeRunId: string | null,
  sessionId: string | null,
  queuedMessages: string = "[]",
): void {
  getDb().prepare(`
    INSERT INTO transcripts (agent_id, instance_id, items, active_run_id, session_id, queued_messages, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, instance_id) DO UPDATE SET
      items=excluded.items, active_run_id=excluded.active_run_id,
      session_id=excluded.session_id, queued_messages=excluded.queued_messages,
      updated_at=excluded.updated_at
  `).run(agentId, instanceId, items, activeRunId, sessionId, queuedMessages, Date.now());
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

// ─── Pipeline operations ───────────────────────────────────────────────────────

interface PipelineRow {
  id: string; project_id: string | null; status: string;
  created_at: number; ended_at: number | null; interrupted: number;
}
interface PipelineStepRow {
  pipeline_id: string; step_index: number; parallel_group: number | null;
  agent_id: string; run_id: string | null; status: string;
  output: string | null; exit_code: number | null;
}

function rowToPipelineRun(row: PipelineRow, stepRows: PipelineStepRow[]): PipelineRun {
  const steps: PipelineRunStep[] = stepRows.map((s) => ({
    stepIndex: s.step_index,
    agentId: s.agent_id,
    runId: s.run_id ?? "",
    status: s.status as PipelineRunStep["status"],
    output: s.output ?? undefined,
    exitCode: s.exit_code ?? undefined,
    parallelGroup: s.parallel_group ?? undefined,
  }));
  return {
    id: row.id,
    projectId: row.project_id ?? undefined,
    status: row.status as PipelineRun["status"],
    createdAt: row.created_at,
    interrupted: row.interrupted === 1 ? true : undefined,
    steps,
  };
}

export function insertPipeline(p: { id: string; projectId?: string; createdAt: number }): void {
  getDb().prepare(
    "INSERT OR IGNORE INTO pipelines (id, project_id, status, created_at, interrupted) VALUES (@id, @projectId, 'running', @createdAt, 0)"
  ).run({ id: p.id, projectId: p.projectId ?? null, createdAt: p.createdAt });
}

export function updatePipelineStatus(id: string, status: string, endedAt?: number): void {
  getDb().prepare("UPDATE pipelines SET status=@status, ended_at=@endedAt WHERE id=@id")
    .run({ id, status, endedAt: endedAt ?? null });
}

export function upsertPipelineStep(s: {
  pipelineId: string; stepIndex: number; parallelGroup?: number;
  agentId: string; runId?: string; status: string; output?: string; exitCode?: number;
}): void {
  getDb().prepare(`
    INSERT INTO pipeline_steps (pipeline_id, step_index, parallel_group, agent_id, run_id, status, output, exit_code)
    VALUES (@pipelineId, @stepIndex, @parallelGroup, @agentId, @runId, @status, @output, @exitCode)
    ON CONFLICT(pipeline_id, step_index) DO UPDATE SET
      run_id=excluded.run_id, status=excluded.status, output=excluded.output, exit_code=excluded.exit_code
  `).run({
    pipelineId: s.pipelineId, stepIndex: s.stepIndex,
    parallelGroup: s.parallelGroup ?? null,
    agentId: s.agentId, runId: s.runId ?? null,
    status: s.status, output: s.output ?? null, exitCode: s.exitCode ?? null,
  });
}

export function getPipelineFromDb(id: string): PipelineRun | null {
  const row = getDb().prepare("SELECT * FROM pipelines WHERE id=?").get(id) as PipelineRow | undefined;
  if (!row) return null;
  const steps = getDb().prepare("SELECT * FROM pipeline_steps WHERE pipeline_id=? ORDER BY step_index").all(id) as PipelineStepRow[];
  return rowToPipelineRun(row, steps);
}

export function listInterruptedPipelines(): PipelineRun[] {
  // Single JOIN instead of N+1 individual steps queries.
  type JoinRow = {
    p_id: string; project_id: string | null; p_status: string;
    created_at: number; ended_at: number | null; interrupted: number;
    step_index: number | null; parallel_group: number | null;
    agent_id: string | null; run_id: string | null; step_status: string | null;
    output: string | null; exit_code: number | null;
  };
  const rows = getDb().prepare(`
    SELECT
      p.id AS p_id, p.project_id, p.status AS p_status, p.created_at, p.ended_at, p.interrupted,
      ps.step_index, ps.parallel_group, ps.agent_id, ps.run_id, ps.status AS step_status, ps.output, ps.exit_code
    FROM (SELECT * FROM pipelines WHERE interrupted=1 ORDER BY created_at DESC LIMIT 50) p
    LEFT JOIN pipeline_steps ps ON ps.pipeline_id = p.id
    ORDER BY p.created_at DESC, ps.step_index
  `).all() as JoinRow[];

  const map = new Map<string, { row: PipelineRow; steps: PipelineStepRow[] }>();
  const order: string[] = [];
  for (const r of rows) {
    if (!map.has(r.p_id)) {
      order.push(r.p_id);
      map.set(r.p_id, {
        row: { id: r.p_id, project_id: r.project_id, status: r.p_status, created_at: r.created_at, ended_at: r.ended_at, interrupted: r.interrupted },
        steps: [],
      });
    }
    if (r.step_index !== null && r.agent_id !== null) {
      map.get(r.p_id)!.steps.push({
        pipeline_id: r.p_id,
        step_index: r.step_index,
        parallel_group: r.parallel_group,
        agent_id: r.agent_id,
        run_id: r.run_id,
        status: r.step_status ?? "pending",
        output: r.output,
        exit_code: r.exit_code,
      });
    }
  }
  return order.map((id) => {
    const { row, steps } = map.get(id)!;
    return rowToPipelineRun(row, steps);
  });
}

// ─── Workflows ─────────────────────────────────────────────────────────────
// Reusable, multi-step prompt library. Stored in the `saved_prompts` table
// for legacy reasons — see the type doc on `Workflow`.

interface WorkflowRow {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: number;
  use_count: number;
}

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    createdAt: row.created_at,
    useCount: row.use_count,
  };
}

export function getWorkflows(opts: { category?: string; q?: string } = {}): Workflow[] {
  const { category, q } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (q) {
    conditions.push("(title LIKE ? OR body LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = getDb().prepare(
    `SELECT * FROM saved_prompts ${where} ORDER BY created_at DESC`
  ).all(...params) as WorkflowRow[];
  return rows.map(rowToWorkflow);
}

export function getWorkflow(id: string): Workflow | null {
  const row = getDb().prepare(
    "SELECT * FROM saved_prompts WHERE id = ?"
  ).get(id) as WorkflowRow | undefined;
  return row ? rowToWorkflow(row) : null;
}

export function createWorkflow(data: { title: string; body: string; category?: string }): Workflow {
  const id = randomUUID();
  const now = Date.now();
  const category = data.category ?? "general";
  getDb().prepare(
    "INSERT INTO saved_prompts (id, title, body, category, created_at, use_count) VALUES (?, ?, ?, ?, ?, 0)"
  ).run(id, data.title, data.body, category, now);
  return { id, title: data.title, body: data.body, category, createdAt: now, useCount: 0 };
}

export function deleteWorkflow(id: string): void {
  getDb().prepare("DELETE FROM saved_prompts WHERE id = ?").run(id);
}

export function recordWorkflowUsage(id: string): void {
  getDb().prepare(
    "UPDATE saved_prompts SET use_count = use_count + 1 WHERE id = ?"
  ).run(id);
}

export function bulkInsertWorkflows(
  workflows: Array<{ title: string; body: string; category: string }>
): number {
  const db = getDb();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO saved_prompts (id, title, body, category, created_at, use_count) VALUES (?, ?, ?, ?, ?, 0)"
  );
  // Deduplicate against existing rows by body
  const existing = new Set(
    (db.prepare("SELECT body FROM saved_prompts").all() as Array<{ body: string }>).map(r => r.body)
  );

  let inserted = 0;
  const seenBodies = new Set<string>();
  db.transaction(() => {
    for (const w of workflows) {
      if (existing.has(w.body) || seenBodies.has(w.body)) continue;
      seenBodies.add(w.body);
      insert.run(randomUUID(), w.title, w.body, w.category, Date.now());
      inserted++;
    }
  })();
  return inserted;
}
