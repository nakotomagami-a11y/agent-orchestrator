# Docs Source Map — Agent Office

**Date:** 2026-05-24  
**Produced by:** Phase 1 explore agent

---

## 1. REST API surface

All routes live under `apps/web/src/app/api/`.

| Method | Path | Request body / query | Response (success) | Description |
|--------|------|---------------------|--------------------|-------------|
| `GET` | `/api/health` | `?force=1` | `{ available, version, error? }` | Claude CLI availability check |
| `GET` | `/api/account` | — | `{ plan: "free"\|"pro"\|"max"\|"api" }` | Read plan from `~/.claude/.credentials.json` |
| `GET` | `/api/agents` | — | `ApiAgent[]` | List all agent definitions |
| `POST` | `/api/agents` | `agentBodySchema` | `{ id }` | Create agent |
| `POST` | `/api/agents/bulk` | `agentBodySchema[]` | `{ written, errors }` | Bulk-create agents |
| `GET` | `/api/agents/:id` | — | `ApiAgent` | Get agent frontmatter |
| `PUT` | `/api/agents/:id` | `agentBodySchema` | `{ id }` | Update agent (backs up body first) |
| `DELETE` | `/api/agents/:id` | — | `{ deleted }` | Delete agent file + memory sidecar |
| `GET` | `/api/agents/:id/body` | — | `text/plain` | Raw markdown body (no frontmatter) |
| `PUT` | `/api/agents/:id/body` | raw text | `204` | Replace body; backs up to `<id>.body.<ISO>.md` |
| `GET` | `/api/agents/:id/body/history` | — | `HistoryEntry[]` | List body backup snapshots |
| `GET` | `/api/agents/:id/body/history/:filename` | — | `text/plain` | Read one snapshot |
| `GET` | `/api/agents/:id/memory` | — | `text/plain` | Per-agent memory file |
| `PUT` | `/api/agents/:id/memory` | raw text (≤256KB) | `"ok"` | Write per-agent memory |
| `GET` | `/api/agents/:id/prompts` | — | `string[]` | Recent prompts for agent |
| `POST` | `/api/agents/:id/prompts` | `{ prompt }` | `{ ok }` | Push a recent prompt |
| `GET` | `/api/agents/:id/uploads` | — | `UploadEntry[]` | List agent uploads |
| `POST` | `/api/agents/:id/uploads` | `multipart/form-data` | `{ name, url }` | Upload file for agent |
| `GET` | `/api/agents/:id/uploads/:filename` | — | binary | Download agent upload |
| `GET` | `/api/memory/global` | — | `text/plain` | Global memory file |
| `PUT` | `/api/memory/global` | raw text (≤256KB) | `"ok"` | Write global memory |
| `POST` | `/api/summon` | `summonRequestSchema` | `{ runId, warning? }` | Spawn claude subprocess for one agent |
| `GET` | `/api/runs` | `?agent=&project=&instance=&limit=` | `PersistedRun[]` | List runs (live + DB) |
| `DELETE` | `/api/runs` | `?agent=` | `{ deleted }` | Delete all runs for an agent |
| `GET` | `/api/runs/:id` | — | `PersistedRun` | Get single run |
| `GET` | `/api/runs/:id/stream` | — | SSE stream | Attach to live run or replay finished |
| `POST` | `/api/runs/:id/abort` | — | `{ aborted }` | SIGKILL the claude subprocess |
| `GET` | `/api/projects` | — | `ProjectSummary[]` | List project summaries |
| `POST` | `/api/projects` | `createProjectSchema` | `Project` | Create project |
| `GET` | `/api/projects/:id` | — | `Project & { runCount, lastRunAt }` | Get project + run stats |
| `PUT` | `/api/projects/:id` | `projectMetaPatchSchema` | updated project | Update project metadata / memory |
| `DELETE` | `/api/projects/:id` | — | `{ deleted }` | Delete project |
| `GET` | `/api/projects/:id/memory` | — | `text/plain` | Project memory |
| `PUT` | `/api/projects/:id/memory` | raw text (≤256KB) | `{ ok }` | Write project memory |
| `GET` | `/api/projects/:id/roster` | — | (via project GET) | — |
| `POST` | `/api/projects/:id/roster` | `rosterAddSchema` | `AgentInstance` | Add agent instance to project |
| `GET` | `/api/projects/:id/roster/:instanceId` | — | `AgentInstance & { spend }` | Get instance + USD spend |
| `PATCH` | `/api/projects/:id/roster/:instanceId` | `rosterPatchSchema` | updated instance | Update instance settings |
| `DELETE` | `/api/projects/:id/roster/:instanceId` | — | result | Remove instance from roster |
| `GET` | `/api/projects/:id/spend` | — | `{ byInstance, total }` | USD spend breakdown by instance |
| `GET` | `/api/projects/:id/git-status` | — | `GitStatus` | Git branch/diff/ahead/behind |
| `GET` | `/api/projects/:id/build` | — | `{ hasBuild }` | Detect build script |
| `POST` | `/api/projects/:id/build` | — | `{ pid }` | Run build in terminal window |
| `GET` | `/api/projects/:id/dev` | — | `{ hasPackageJson, hasNodeModules, pm, commands }` | Detect dev commands |
| `POST` | `/api/projects/:id/dev` | `{ commandKey? }` | `{ key, port, url, pid }` | Spawn dev server in terminal |
| `POST` | `/api/projects/:id/install` | — | `{ ok, pm }` | Run `<pm> install` |
| `POST` | `/api/projects/:id/open-folder` | — | `{ ok }` | `xdg-open` project directory |
| `GET` | `/api/projects/:id/uploads` | — | `UploadEntry[]` | List project uploads |
| `POST` | `/api/projects/:id/uploads` | `multipart/form-data` | `{ name, url }` | Upload file for project |
| `GET` | `/api/projects/:id/uploads/:filename` | — | binary | Download project upload |
| `POST` | `/api/pipeline` | `createPipelineRequestSchema` | `{ pipelineId, steps }` (202) | Create & start multi-agent pipeline |
| `GET` | `/api/pipeline/:id` | — | `PipelineRun` | Poll pipeline status |
| `POST` | `/api/broadcast` | `broadcastRequestSchema` | `{ broadcastId, runIds }` (202) | Fan-out prompt to all roster instances |
| `GET` | `/api/processes` | — | `ProcessInfo[]` | List user's listening ports (Linux only) |
| `GET` | `/api/processes/:pid` | — | `{ alive }` | Check process liveness |
| `DELETE` | `/api/processes/:pid` | — | `{ ok }` | SIGKILL process |
| `GET` | `/api/processes/:pid/logs` | — | `{ lines, exitCode, signal, found }` | Captured stdout/stderr |
| `GET` | `/api/settings` | — | `AppSettings` | Read app settings |
| `PUT` | `/api/settings` | `settingsPatchSchema` | `AppSettings` | Write app settings |
| `GET` | `/api/settings/scan` | `?root=&excluded=&includeExcluded=` | `ScannedEntry[]` | Scan filesystem for projects |
| `GET` | `/api/ui-settings` | — | `Record<string,string>` | All UI settings from SQLite |
| `PATCH` | `/api/ui-settings` | `Record<string,string>` | `{ ok }` | Write allowed UI settings |
| `GET` | `/api/skills/installed` | — | `InstalledSkill[]` | List installed skills |
| `POST` | `/api/skills/install` | `skillInstallSchema` | `{ ok, name }` | Install skill from GitHub |
| `GET` | `/api/skills/registry` | `?refresh=1` | `RegistrySkill[]` | Fetch skill registry (1hr cache) |
| `GET` | `/api/skills/sources` | — | registry source list | Registry source definitions |
| `GET` | `/api/skills/updates` | — | `SkillUpdate[]` | Check installed skills for updates |
| `GET` | `/api/skills/:name` | — | `InstalledSkill` | Get single installed skill |
| `DELETE` | `/api/skills/:name` | — | `{ removed }` | Uninstall skill |
| `POST` | `/api/skills/:name/update` | — | `{ ok, name, ... }` | Update skill to latest SHA |
| `GET` | `/api/starter/agents` | — | `StarterAgent[]` | List bundled starter agents |
| `POST` | `/api/starter/agents` | `{ agentIds: string[] }` | `{ imported, skipped }` | Import selected starter agents |
| `GET` | `/api/templates` | — | `AgentTemplate[]` | List agent creation templates |
| `GET` | `/api/transcripts` | `?agentId=&instanceId=` | `TranscriptRow` or list | Get/list conversation transcripts |
| `PUT` | `/api/transcripts` | `?agentId=&instanceId=` + body | `{ ok }` | Save transcript |
| `DELETE` | `/api/transcripts` | `?agentId=&instanceId=` | `{ ok }` | Clear transcript |
| `GET` | `/api/drafts` | `?agentId=&instanceId=` | `{ text }` | Get composer draft |
| `PUT` | `/api/drafts` | `?agentId=&instanceId=` + `{ text }` | `{ ok }` | Save composer draft |
| `GET` | `/api/prompts` | — | `Record<string,string[]>` | All recent prompts keyed by agentId |
| `POST` | `/api/clipboard-image` | — | `image/png` | Read clipboard PNG via `wl-paste` (Wayland) |
| `GET` | `/api/save/export` | `?projectId=&history=1` | JSON attachment | Export project save file |
| `POST` | `/api/save/import` | save file JSON | `{ ok, agentCount }` | Import project save file |

**Validation schemas** (cited source: `apps/web/src/lib/validation-schemas.ts`):

- `summonRequestSchema` (line 96): `agentId`, `prompt` (≤`MAX_PROMPT_BYTES`=100KB), `model?`, `effort?`, `maxBudgetUsd?`, `cwd?`, `projectId?`, `instanceId?`, `resumeSessionId?`
- `agentBodySchema` (line 4): `name`, `id`, `desc`, `skills[]`, `tools[]`, `pm`, `model`, `effort`, `body`, `room?`, `unit?`
- `createPipelineRequestSchema` (line 153): `steps` (2–10 groups), `projectId?`, `cwd?`
- `broadcastRequestSchema` (line 162): `projectId`, `prompt`, `model?`, `effort?`, `cwd?`
- `rosterAddSchema` (line 61): `agentId`, `force?`, `init?` (`label`, `model`, `effort`, `permissionMode`, `room`)

---

## 2. SSE event types

All events are emitted from `packages/shared/src/services/runs.ts` via the `broadcast()` function and delivered through `apps/web/src/app/api/runs/[id]/stream/route.ts`.

The SSE wire format is `event: <name>\ndata: <json>\n\n`.

| Event name | Payload type | Payload fields | Where emitted | Subscriber |
|------------|-------------|----------------|---------------|------------|
| `attached` | `SseAttachedEvent` | `runId, output, tokensIn, tokensOut, cost, status, startTs` | `runs.ts:289` (`attachEmit`) | `use-run-stream.ts` |
| `chunk` | `SseChunkEvent` | `runId, text` | `runs.ts:427` (text delta), `runs.ts:445` (assistant block) | `use-run-stream.ts` |
| `tool` | `SseToolEvent` | `runId, name, input?` | `runs.ts:432` (content_block_start), `runs.ts:448` (assistant block) | `use-run-stream.ts` |
| `usage` | `SseUsageEvent` | `runId, tokensIn, tokensOut, cost` | `runs.ts:460` (per-message), `runs.ts:494` (result event) | `use-run-stream.ts` |
| `done` | `SseDoneEvent` | `runId, exitCode, sessionId?, durationMs?, tokensIn?, tokensOut?, cost?` | `runs.ts:551` (finalizeRun), `runs.ts:307` (attachEmit replay) | `use-run-stream.ts` |
| `error` | `SseErrorEvent` | `runId, message` | `runs.ts:265` (spawn error), `runs.ts:479` (rate limit), `runs.ts:497` (is_error result) | `use-run-stream.ts` |

**Replay:** Events `chunk`, `tool`, and `usage` are stored in `run.eventLog` (`runs.ts:57`) and replayed to late subscribers via `attachEmit` (`runs.ts:303`). `done` and `error` are not stored in `eventLog`.

**Heartbeat:** The SSE route sends `: keepalive\n\n` every 25 seconds (`stream/route.ts:9`).

**Type definitions:** `packages/shared/src/types/index.ts` lines 173–194.

---

## 3. SQLite schema

**File:** `packages/shared/src/services/db.ts`  
**Path:** `~/.claude/agent-office/db.sqlite` (`paths.ts:34`)  
**Pragmas:** `journal_mode = WAL`, `foreign_keys = ON`, `synchronous = NORMAL` (`db.ts:17–19`)  
**Migration system:** `user_version` pragma tracks version; 3 migrations run at startup (`db.ts:169–176`).  
**Crash recovery:** On open, all `status='running'` runs are set to `status='error', exit_code=-1`; all `status='running'` pipelines are set to `status='error', interrupted=1` (`db.ts:24–29`).

### Tables

| Table | Columns | Notes |
|-------|---------|-------|
| `runs` | `id TEXT PK`, `agent_id TEXT`, `agent_name TEXT`, `instance_id TEXT DEFAULT 'default'`, `instance_label TEXT`, `project_id TEXT`, `session_id TEXT`, `status TEXT DEFAULT 'running'`, `exit_code INTEGER`, `prompt TEXT`, `output TEXT DEFAULT ''`, `tokens_in INTEGER DEFAULT 0`, `tokens_out INTEGER DEFAULT 0`, `cost_usd REAL DEFAULT 0`, `dur_ms INTEGER`, `model TEXT DEFAULT ''`, `effort TEXT DEFAULT ''`, `cwd TEXT`, `started_at INTEGER`, `ended_at INTEGER` | Migration v0→v1, `db.ts:37` |
| `messages` | `id TEXT PK`, `run_id TEXT REFERENCES runs(id)`, `agent_id TEXT`, `instance_id TEXT DEFAULT 'default'`, `role TEXT CHECK(role IN ('user','assistant'))`, `content TEXT`, `ts INTEGER` | Truncated at insert: user≤2000 chars, assistant≤8000 (`db.ts:421`) |
| `tool_calls` | `id TEXT PK`, `run_id TEXT REFERENCES runs(id)`, `name TEXT`, `input TEXT`, `ts INTEGER` | Best-effort insert (`db.ts:477`) |
| `recent_prompts` | `id INTEGER PK AUTOINCREMENT`, `agent_id TEXT`, `prompt TEXT`, `used_at INTEGER` | Max 10 per agent (`db.ts:482`) |
| `transcripts` | `agent_id TEXT`, `instance_id TEXT DEFAULT 'default'`, `items TEXT DEFAULT '[]'`, `active_run_id TEXT`, `session_id TEXT`, `updated_at INTEGER`, `PK(agent_id, instance_id)` | `db.ts:85` |
| `drafts` | `agent_id TEXT`, `instance_id TEXT DEFAULT 'default'`, `text TEXT DEFAULT ''`, `updated_at INTEGER`, `PK(agent_id, instance_id)` | `db.ts:95` |
| `ui_settings` | `key TEXT PK`, `value TEXT`, `updated_at INTEGER` | Internal keys prefixed `_` filtered from GET (`db.ts:596`) |
| `pipelines` | `id TEXT PK`, `project_id TEXT`, `status TEXT DEFAULT 'running'`, `created_at INTEGER`, `ended_at INTEGER`, `interrupted INTEGER DEFAULT 0` | Migration v1→v2, `db.ts:136` |
| `pipeline_steps` | `pipeline_id TEXT REFERENCES pipelines(id)`, `step_index INTEGER`, `parallel_group INTEGER`, `agent_id TEXT`, `run_id TEXT`, `status TEXT DEFAULT 'pending'`, `output TEXT`, `exit_code INTEGER`, `PK(pipeline_id, step_index)` | `db.ts:144` |

### Virtual table

| Table | Type | Notes |
|-------|------|-------|
| `messages_fts` | `fts5` | `content=messages, content_rowid=rowid` — kept in sync by triggers (`db.ts:109`) |

### Indexes

| Index | Table | Columns | Migration |
|-------|-------|---------|-----------|
| `idx_runs_agent` | `runs` | `(agent_id, started_at DESC)` | v0→v1 |
| `idx_runs_project` | `runs` | `(project_id, started_at DESC)` | v0→v1 |
| `idx_runs_instance` | `runs` | `(agent_id, instance_id, started_at DESC)` | v0→v1 |
| `idx_messages_run` | `messages` | `(run_id)` | v0→v1 |
| `idx_messages_ai` | `messages` | `(agent_id, instance_id, ts DESC)` | v0→v1 |
| `idx_tool_calls_run` | `tool_calls` | `(run_id)` | v0→v1 |
| `idx_prompts_agent` | `recent_prompts` | `(agent_id, used_at DESC)` | v0→v1 |
| `idx_pipeline_steps_pipeline` | `pipeline_steps` | `(pipeline_id)` | v1→v2 |
| `idx_pipelines_project` | `pipelines` | `(project_id, created_at DESC)` | v1→v2 |
| `idx_runs_started_at` | `runs` | `(started_at DESC)` | v2→v3 |

---

## 4. Claude CLI flag set

**Source:** `packages/shared/src/services/summon.ts` (`buildClaudeArgs`, lines 13–51)  
**Invocation:** `spawn("claude", opts.args, ...)` in `runs.ts:183`

The argv list built in order:

| Position | Flag / Value | Source |
|----------|-------------|--------|
| 0 | `-p` | hardcoded |
| 1 | `--agent` | hardcoded |
| 2 | `<agentId>` | `request.agentId` |
| 3 | `--output-format` | hardcoded |
| 4 | `stream-json` | hardcoded |
| 5 | `--include-partial-messages` | hardcoded |
| 6 | `--verbose` | hardcoded |
| (optional) | `--model <model>` | `request.model ?? instance.model ?? agent.defaultModel` (omitted if `"default"`) |
| (optional) | `--effort <effort>` | `request.effort ?? instance.effort ?? agent.defaultEffort` (omitted if `"default"`) |
| (optional) | `--max-budget-usd <n>` | `request.maxBudgetUsd` (omitted if ≤0) |
| (optional) | `--permission-mode <mode>` | `instance.permissionMode ?? agent.permissionMode` |
| (per dir) | `--add-dir <dir>` | each entry in `agent.addDirs[]`, tilde-expanded (`summon.ts:42`) |
| (optional) | `--append-system-prompt <text>` | `appendedSystemPrompt` from `buildAppendedPrompt()` |
| (optional) | `--resume <sessionId>` | `request.resumeSessionId` |
| last | `<prompt>` | `priorContext + request.prompt` or just `request.prompt` |

**Retry logic:** If the run exits with code 1 and stderr contains `"No conversation found with session ID"`, the `--resume` flag and its value are stripped and claude is re-spawned (`runs.ts:243–268`).

**PATH augmentation:** Before spawn, `buildAugmentedPath()` prepends NVM node bin dirs, `~/.local/bin`, `/usr/local/bin`, `/usr/bin`, `/bin` (`paths.ts:77–103`).

---

## 5. Environment variables

| Variable | Required | Default | What it controls | Source |
|----------|----------|---------|-----------------|--------|
| `ANTHROPIC_API_KEY` | Yes (for Claude) | none | API key passed to `claude` subprocess via inherited env | `apps/web/src/app/(app)/docs/page.tsx:226` (docs only — never read by app code directly) |
| `PATH` | No | system | Augmented before every `claude` spawn | `paths.ts:99` |
| `AGENT_OFFICE_STARTER_DATA` | No | `<cwd>/starter-data` | Override path to bundled starter-data directory | `instrumentation-node.ts:31`, `starter/agents/route.ts:31` |
| `NEXT_PUBLIC_POLL_RUNS` | No | `5000` | Polling interval (ms) for run list | `lib/polling.ts:9` |
| `NEXT_PUBLIC_POLL_HEALTH` | No | `30000` | Polling interval (ms) for health check | `lib/polling.ts:10` |
| `NEXT_PUBLIC_POLL_SKILLS_UPDATES` | No | `60000` | Polling interval (ms) for skills update check | `lib/polling.ts:11` |
| `DEFAULT_LOCALE` | No | `"en"` | i18n locale override | `src/i18n/request.ts:11` |
| `NODE_ENV` | No | `"production"` | Enables React Query Devtools when `"development"` | `apps/web/src/app/providers.tsx:31` |
| `PORT` | No | set dynamically | Injected into terminal env when launching dev server | `projects/[id]/dev/route.ts:184` |

---

## 6. File-system layout

**Source:** `packages/shared/src/services/paths.ts`

| Path | Read / Write | What it is |
|------|-------------|------------|
| `~/.claude/` | R/W | Root of all Claude and Agent Office data |
| `~/.claude/agents/` | R/W | Agent definition `.md` files (`paths.ts:10`) |
| `~/.claude/agents/<id>.md` | R/W | Agent definition + system prompt body |
| `~/.claude/agents/<id>.memory.md` | R/W | Per-agent memory file (`agents.ts:113`) |
| `~/.claude/agents/<id>.body.<ISO>.md` | W | Body backup snapshot (max 10 per agent) (`agents/[id]/route.ts:29`) |
| `~/.claude/agents/_global.memory.md` | R/W | Global memory injected into every agent (`paths.ts:11`) |
| `~/.claude/agents/_skills/` | R/W | Installed skill packs (`paths.ts:12`) |
| `~/.claude/agents/_skills/<name>/SKILL.md` | R/W | Skill body file |
| `~/.claude/agents/_skills/<name>/.source.json` | R/W | Skill install provenance (source, ref, path, sha) |
| `~/.claude/agents/_skills/_registry.json` | R/W | Skills registry cache (1hr TTL) (`skills.ts:29`) |
| `~/.claude/agents/_uploads/<agentId>/` | R/W | Per-agent file uploads (`paths.ts:37`) |
| `~/.claude/projects/` | R/W | Project metadata root (`paths.ts:13`) |
| `~/.claude/projects/<id>/project.md` | R/W | Project metadata + roster + memory |
| `~/.claude/projects/<id>/_uploads/` | R/W | Per-project file uploads (`paths.ts:38`) |
| `~/.claude/agent-office/` | R/W | App-specific state (`paths.ts:17`) |
| `~/.claude/agent-office/db.sqlite` | R/W | SQLite database (runs, messages, transcripts, etc.) (`paths.ts:34`) |
| `~/.claude/agent-office/runs.log` | R (migration only) | Legacy JSONL run log (read once during migration) |
| `~/.claude/agent-office/recent-prompts.json` | R (migration only) | Legacy prompts JSON (read once during migration) |
| `~/.claude/agent-office/history/` | R (migration only) | Legacy per-agent JSONL history files |
| `~/.claude/.credentials.json` | R | Claude auth credentials (plan detection) (`account/route.ts:9`) |
| `~/.claude/agent-office-settings.json` | R/W | App settings (projectsRoot, excluded, firstRunComplete) (`paths.ts:14`) |
| `<projectCwd>/.worktrees/<instanceId>/` | R/W | Git worktree per agent instance (multi-instance) (`worktrees.ts:22`) |
| `<projectCwd>/.ao.json` | R | Per-project build/dev command overrides (`build/route.ts:65`, `dev/route.ts:66`) |
| `<cwd>/starter-data/agents/` | R | Bundled starter agent `.md` files |
| `<cwd>/starter-data/skills/` | R | Bundled starter skill directories |
| `/proc/<pid>/status`, `/proc/<pid>/stat`, `/proc/<pid>/cmdline`, `/proc/<pid>/cwd` | R | Linux process inspection (`processes/route.ts`) |

---

## 7. Tool reference

**Source:** `packages/shared/src/config/agent-opts.ts` (model/effort options only — no tool allowlist there)  
**Tool list source:** `agents.ts:62` reads `fm.tools ?? fm["allowed-tools"]` from agent frontmatter  
**Passed to CLI:** The tools array is written into the agent `.md` file's `tools:` frontmatter; Claude Code reads it and passes `--allowedTools` internally.

The `tools:` frontmatter field accepts any Claude Code tool name. Observed values in starter agents and docs:

| Tool name | Category | Notes |
|-----------|----------|-------|
| `Read` | File system | Read files |
| `Write` | File system | Write/create files |
| `Edit` | File system | Edit file content |
| `Bash` | Shell | Execute bash commands |
| `Glob` | File system | Pattern file listing |
| `Grep` | Search | Content search |
| `LS` | File system | Directory listing |
| `Task` | Agent | Spawn sub-agents |
| `TodoRead` | Memory | Read todo list |
| `TodoWrite` | Memory | Write todo list |
| `WebFetch` | Network | HTTP fetch |
| `WebSearch` | Network | Web search |
| `mcp__playwright__*` | MCP | Browser automation via Playwright MCP server (user's CLAUDE.md) |
| `mcp__chrome-devtools__*` | MCP | Chrome DevTools MCP (user's CLAUDE.md) |

**Permission modes** (from `agents.ts:65` / frontmatter `permission-mode`):
- `default` — Claude Code prompts on destructive actions
- `bypassPermissions` — all permissions auto-approved
- `plan` — read-only planning mode; history note is omitted from appended prompt (`agents.ts:166`)

There is no application-level allowlist for tool names — the value from frontmatter is passed verbatim to the CLI. Validation schema (`agentBodySchema`) accepts any `string[]` for `tools`.

---

## 8. Features inventory

### Modules under `apps/web/src/modules/`

| Feature | Module path | What it does | Documented (Y/N) |
|---------|-------------|-------------|-----------------|
| Agent management | `modules/agents/` | CRUD UI for agent definitions, form, list, body history panel | Y (partial) |
| Office floor | `modules/office/` | Isometric pixel office view, desk layout, camera, drag, build/paint mode | Y (Usage tab) |
| Summon / chat | `modules/summon/` | Conversation panel, chat thread, SSE stream consumer, composer, live status | Y (partial) |
| Run history | `modules/runs/` | Run list, detail, compare modal, activity feed | Y (Usage tab) |
| Projects | `modules/projects/` | Project list, detail, activity, add-agent modal, spend hook | Y (partial) |
| Memory editor | `modules/memory/` | In-UI editor for agent/project/global memory | Y (partial) |
| Settings | `modules/settings/` | App settings page (projects root, exclusions) | N |
| Skills | `modules/skills/` | Skills browser, install/update UI, registry filter | Y (partial) |
| Search | `modules/search/` | Full-text run search via FTS5 | N |
| Onboarding | `modules/onboarding/` | First-run gate and wizard | N |
| Processes | `modules/processes/` | Dev process monitor modal | N |
| Limits | `modules/limits/` | Claude spend limits / quota modal | N |

### API folders under `apps/web/src/app/api/`

| Feature | API path prefix | What it does | Documented (Y/N) |
|---------|----------------|-------------|-----------------|
| Agent CRUD | `/api/agents` | Manage agent files | N (REST) |
| Agent bulk import | `/api/agents/bulk` | Bulk write agents | N |
| Agent body history | `/api/agents/:id/body/history` | Snapshot/restore | N |
| Memory (global) | `/api/memory/global` | Global memory R/W | N (REST) |
| Summon | `/api/summon` | Spawn claude subprocess | Y (architecture diagram) |
| Run stream | `/api/runs/:id/stream` | SSE event stream | Y (architecture diagram) |
| Run abort | `/api/runs/:id/abort` | Kill subprocess | N |
| Run CRUD | `/api/runs` | List/delete runs | N |
| Project CRUD | `/api/projects` | Manage projects | N (REST) |
| Project spend | `/api/projects/:id/spend` | USD tracking | N |
| Project worktrees | (via roster) | Git worktree per instance | N |
| Project build | `/api/projects/:id/build` | Build script runner | N |
| Project dev | `/api/projects/:id/dev` | Dev server launcher | N |
| Project install | `/api/projects/:id/install` | npm/pnpm/bun install | N |
| Git status | `/api/projects/:id/git-status` | Branch/diff info | N |
| Pipeline | `/api/pipeline` | Multi-step agent chain | N |
| Broadcast | `/api/broadcast` | Fan-out to roster | N |
| Processes | `/api/processes` | Port/process monitor | N |
| Settings | `/api/settings` | App settings R/W | N |
| Settings scan | `/api/settings/scan` | Filesystem project scan | N |
| UI settings | `/api/ui-settings` | SQLite-backed UI state | N |
| Skills | `/api/skills/*` | Install/update/registry | Y (partial) |
| Starter agents | `/api/starter/agents` | Bundled agent catalogue | N |
| Templates | `/api/templates` | Agent creation templates | N |
| Transcripts | `/api/transcripts` | Conversation transcript R/W/D | N |
| Drafts | `/api/drafts` | Composer draft persistence | N |
| Prompts | `/api/prompts` | Recent prompts log | N |
| Health | `/api/health` | Claude CLI availability | N |
| Account | `/api/account` | Plan detection | N |
| Save/Export | `/api/save/export` | Project save file export | N |
| Save/Import | `/api/save/import` | Project save file import | N |
| Clipboard image | `/api/clipboard-image` | Wayland clipboard paste | N |
| Uploads | `/api/agents/:id/uploads`, `/api/projects/:id/uploads` | File attachment handling | N |
