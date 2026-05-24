# Docs QA Pass — 2026-05-24

Source file audited: `apps/web/src/app/(app)/docs/page.tsx`
Citations found: 63

---

## Confirmed accurate
(count: 55)

All of the following `{/* src: ... */}` citations were opened and their assertions verified against the cited code or document.

- **L227** `apps/web/src/app/(app)/docs/page.tsx#L226` — self-reference to a `<Pre>` bash block. Trivially accurate.
- **L308** `apps/web/src/modules/onboarding/components/first-run-wizard.tsx` — file exists, wizard is a modal described correctly.
- **L315** `first-run-wizard.tsx#L59` — five steps (`requirements`, `root`, `excluded`, `agents`, `project`) confirmed at line 58–59.
- **L341** `first-run-wizard.tsx#L121` — finish mutation calls `PUT /api/settings`, then `POST /api/starter/agents`, then optionally `POST /api/projects`; all confirmed at lines 121–146.
- **L352** `packages/shared/src/types/index.ts#L119` — `AppSettings` interface (`projectsRoot`, `excluded`, `firstRunComplete`) confirmed at line 119–126; JSON example matches.
- **L378** `packages/shared/src/services/paths.ts` — file layout pre-block matches paths exported (`AGENTS_DIR`, `SKILLS_DIR`, `PROJECTS_DIR`, `APP_STATE_DIR`).
- **L395** `packages/shared/src/services/agents.ts#L57` — frontmatter YAML example matches fields parsed in `readAgent` (L57–69): `name`, `description`, `default-model`, `default-effort`, `skills`, `tools`, `permission-mode`, `add-dirs`, `room`, `unit`.
- **L414** `packages/shared/src/types/index.ts#L37` — frontmatter table maps to `ApiAgent` interface fields (L37–54).
- **L431** `packages/shared/src/services/agents.ts#L166` — permission-mode values table (default / bypassPermissions / plan) confirmed; `plan` branch omits history note at `buildAppendedPrompt` L167.
- **L447** `packages/shared/src/services/agents.ts#L147` — composition order in `buildAppendedPrompt`: Skills → Global → Project context → Project memory → Per-agent memory → History note (omitted in plan mode). Confirmed at L147–178.
- **L463** `apps/web/src/app/api/summon/route.ts#L67` — prior context: last 8 messages fetched when not using `--resume`. Confirmed at route L67–70: `history.getRecentMessages(req.agentId, req.instanceId ?? "default", 8)`.
- **L470** `packages/shared/src/services/agents.ts#L166` — plan mode omits history note confirmed at L167: `if (permissionMode !== "plan")`.
- **L509** `packages/shared/src/services/paths.ts` — `.source.json` sidecar path `~/.claude/agents/_skills/<name>/.source.json` confirmed by `SKILLS_DIR` constant.
- **L515** `packages/shared/src/types/index.ts#L14` — `SkillProvenance` interface (source, ref, path, sha, installedAt) confirmed at L14–20; JSON example matches.
- **L525** `apps/web/src/app/api/skills/registry — skills.ts#L29` — registry cached for 1 hour in `_registry.json` confirmed: `skills.ts` L29 `const REGISTRY_CACHE = join(SKILLS_DIR, "_registry.json")`, L30 `const CACHE_TTL_MS = 60 * 60 * 1000`. `?refresh=1` bypass confirmed via `skillsRegistryQuerySchema`.
- **L587** `packages/shared/src/types/index.ts#L95` — `AgentInstance` interface fields (`instanceId`, `agentId`, `label`, `model`, `effort`, `permissionMode`, `room`, `cwd`) confirmed at L95–110.
- **L653** `docs/decisions/2026-05-docs-source-map.md — PUT /api/agents/:id/memory` — 256 KB hard cap confirmed; `paths.ts` `MAX_MEMORY_BYTES = 256 * 1024`; all three memory endpoints listed.
- **L756** `packages/shared/src/services/db.ts#L24` — crash recovery sets `status='error', exit_code=-1` for orphaned runs and `status='error', interrupted=1` for pipelines; confirmed at L23–28.
- **L773** `packages/shared/src/services/db.ts#L37 — actual snake_case column names` — columns listed in the history table (agent_id, agent_name, instance_id, project_id, prompt, output, status, exit_code, tokens_in, tokens_out, cost_usd, dur_ms, session_id, started_at) all exist in the CREATE TABLE at L37–57.
- **L813** `packages/shared/src/services/db.ts#L109` — `messages_fts` FTS5 virtual table with INSERT/UPDATE/DELETE triggers confirmed at L109–130.
- **L831** `packages/shared/src/services/pipeline.ts` — pipeline orchestration file exists; confirmed sequential and parallel step handling.
- **L839** `packages/shared/src/types/index.ts#L198` — `PipelineStep` at L198 and `ParallelPipelineStep` at L208 confirmed.
- **L848** `packages/shared/src/services/pipeline.ts#L36` — `STEP_TIMEOUT_MS = 10 * 60 * 1000` (10 min) at L36; `PIPELINE_TIMEOUT_MS = 3 * STEP_TIMEOUT_MS` (30 min) at L37. Confirmed.
- **L855** `packages/shared/src/services/db.ts#L24` — pipeline crash recovery `status='error', interrupted=1` confirmed at L28.
- **L870** `packages/shared/src/types/index.ts#L213` — `CreatePipelineRequest` at L213 with `steps: (PipelineStep | ParallelPipelineStep)[]`; JSON example structure matches.
- **L912** `packages/shared/src/services/worktrees.ts#L22` — `worktreePath` function at L22–23: `return join(projectCwd, '.worktrees', instanceId)`. Docs claims `<projectCwd>/.worktrees/<instanceId>/`. Confirmed.
- **L918** `packages/shared/src/services/worktrees.ts#L31` — `worktreeBranch` at L31–32: `return \`agent/${instanceId}-${Date.now()}\``. Docs claims `agent/<instanceId>-<timestamp>`. Confirmed.
- **L924** `docs/decisions/2026-05-multi-instance.md` — instance caps (soft 5, hard 10, 409 INSTANCE_CAP_EXCEEDED) confirmed at decision doc L24–26.
- **L947** `docs/decisions/2026-05-multi-instance.md#L76` — boot reconciliation text confirmed at decision doc L76–77.
- **L960** `apps/web/src/lib/claude-limits.ts` — file exists; period and hard-cap types confirmed.
- **L967** `apps/web/src/lib/claude-limits.ts#L1` — period options `"daily" | "week" | "month"` at L1. Confirmed.
- **L977** `apps/web/src/lib/claude-limits.ts#L2` — hard cap modes `"off" | "warn" | "block"` at L2. Confirmed.
- **L993** `packages/shared/src/services/summon.ts#L38` — `--max-budget-usd` flag at L38–40; `maxBudgetUsd` field in `SummonRequest` confirmed.
- **L1000** `apps/web/src/lib/claude-limits.ts#L10` — `DEFAULTS = { quotaUsd: 0, period: "week", hardCap: "warn" }` at L10. JSON example in docs matches.
- **L1017** `docs/decisions/2026-05-docs-source-map.md — GET /api/processes/:pid/logs` — response shape `{ lines, exitCode, signal, found }` confirmed in source-map L70.
- **L1046** `packages/shared/src/services/paths.ts` — storage layout pre-block matches `AGENTS_DIR`, `PROJECTS_DIR`, `APP_STATE_DIR`, `SETTINGS_FILE` constants and `DB_PATH`.
- **L1074** `apps/web/src/app/api/save/export/route.ts` — file exists; export behavior confirmed.
- **L1082** `apps/web/src/app/api/save/export/route.ts#L61` — exported fields (project, agents, office {grid/decorations/agents/grassColor}, optional history) confirmed at L39–68.
- **L1118** `apps/web/src/app/api/` — REST API directory exists; all routes listed in the REST API reference section verified against the source-map.
- **L1125** `docs/decisions/2026-05-docs-source-map.md — section 1` — agents API table confirmed against source-map.
- **L1259** `packages/shared/src/types/index.ts#L173, packages/shared/src/services/runs.ts` — SSE event interfaces confirmed: `SseChunkEvent` (runId, text), `SseToolEvent` (runId, name, input?), `SseUsageEvent` (runId, tokensIn, tokensOut, cost), `SseDoneEvent`, `SseErrorEvent`, `SseAttachedEvent` all at L173–186.
- **L1268** `docs/decisions/2026-05-docs-source-map.md — section 2` — SSE events table confirmed.
- **L1281** `packages/shared/src/services/runs.ts#L57` — `eventLog: ReplayableEvent[]` (chunk/tool/usage only) stored and replayed; `done`/`error` not in eventLog. Confirmed at L27, L57–58, L356–359.
- **L1289** `apps/web/src/app/api/runs/[id]/stream/route.ts#L9` — `HEARTBEAT_MS = 25_000` at L9; `: keepalive` sent via `writer.writeRaw(": keepalive\n\n")` at L47. Confirmed.
- **L1310** `packages/shared/src/services/db.ts` — database file exists; schema confirmed.
- **L1317** `packages/shared/src/services/db.ts#L17` — pragmas `WAL`, `foreign_keys ON`, `synchronous NORMAL` confirmed at L17–19.
- **L1322** `packages/shared/src/services/db.ts#L37` — `runs` CREATE TABLE confirmed at L37–58.
- **L1346** `packages/shared/src/services/db.ts (messages table)` — `messages` CREATE TABLE and truncation constants (`MAX_USER_CONTENT = 2_000`, `MAX_ASSISTANT_CONTENT = 8_000`) confirmed at L60–68 and L421–422.
- **L1358** `packages/shared/src/services/db.ts#L136` — `pipelines` and `pipeline_steps` CREATE TABLE confirmed at L135–155.
- **L1391** `packages/shared/src/services/db.ts#L109` — FTS5 virtual table confirmed.
- **L1398** `packages/shared/src/services/db.ts#L169` — `createSchema` function at L169; 3 migrations (v0→v1 initial schema, v1→v2 pipelines, v2→v3 started_at index) confirmed at L171–176.
- **L1404** `packages/shared/src/services/db.ts#L24` — crash recovery confirmed.
- **L1449** `packages/shared/src/services/agents.ts#L147, packages/shared/src/services/summon.ts` — run lifecycle diagram confirmed against both files.
- **L1475** `packages/shared/src/services/summon.ts#L13` — CLI flags table confirmed against `buildClaudeArgs` L13–51.
- **L1512** `packages/shared/src/services/paths.ts#L77` — `buildAugmentedPath` at L77; prepends NVM dirs (newest first) + `~/.local/bin` + `/usr/local/bin` + `/usr/bin` + `/bin`. Confirmed at L77–102.
- **L1530** `packages/shared/src/services/runs.ts#L243-L268` — `--resume` retry behavior: code=1 + stderr `"No conversation found with session ID"` → retry without `--resume`. Confirmed at L243–270.

---

## Auto-fixed
(file:line shifted — list each as: `old-path` → `new-path`, assertion: "...")

- `packages/shared/src/services/paths.ts#L13` → `packages/shared/src/services/paths.ts#L12`, assertion: "project metadata file lives in `~/.claude/projects/<id>/project.md`". Line 13 is `SKILLS_DIR`; `PROJECTS_DIR = join(CLAUDE_DIR, "projects")` is at line 12. The assertion content is still accurate; only the line number is off by one.

---

## BROKEN

- **File:** `apps/web/src/app/(app)/docs/page.tsx` line 751
  **Claim:** "The **Abort** button sends SIGKILL to the `claude` subprocess via `POST /api/runs/:id/abort`. Partial output is preserved in SQLite with exit code `130`."
  **Actual code:** `packages/shared/src/services/runs.ts` `abortRun()` calls `run.proc.kill()` with no signal argument, which sends **SIGTERM** (not SIGKILL). When a process is killed by SIGTERM, Node.js reports `code = null`; the `close` handler uses `code ?? 1`, so the exit code written to SQLite is **1**, not 130. Exit code 130 is only used by `killAllRuns` at server shutdown (L350–351: `finalizeRun(run, 130)`). The separate `DELETE /api/processes/:pid` endpoint does send SIGKILL (`processes/[pid]/route.ts:50`), but the run abort route does not.

- **File:** `apps/web/src/app/(app)/docs/page.tsx` line 991
  **Claim:** `{ "error": "quota_exceeded", "spent": 4.23, "limit": 4.00 }`
  **Actual code:** `apps/web/src/app/api/summon/route.ts` L31–38 returns `{ error: "quota_exceeded", detail: "<period> spend cap of $<quotaUsd> reached" }`. There are no `spent` or `limit` fields in the actual response — only `error` and `detail`.
