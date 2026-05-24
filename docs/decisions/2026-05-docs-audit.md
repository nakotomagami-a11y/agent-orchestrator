# Docs Audit Memo

**Date:** 2026-05-24  
**Produced by:** Phase 1 explore agent

## Scope

The in-app docs page (`apps/web/src/app/(app)/docs/page.tsx`) has five tabs: Getting Started, Agents, Projects & Memory, Usage, Reference. The landing docs (`apps/landing/src/app/docs/page.tsx`) mirrors the same content. Both cover the same topics at the same depth.

---

## Tier 1 — User-blocking gaps

Features users depend on daily with NO documentation at all.

| Feature | What's missing | Source |
|---------|---------------|--------|
| Settings page (projects root, exclusions) | No documentation of the settings flow, what `projectsRoot` controls, or how exclusions work. New users fail to configure the app at setup. | `modules/settings/components/settings-page.tsx`, `apps/web/src/app/api/settings/route.ts` |
| Spend limits / quota modal | The `limits` module and the `claude-limits` UI setting exist but are never explained. Users do not know how to set a hard cap or warn threshold. | `modules/limits/components/claude-limits-modal.tsx`, `apps/web/src/lib/claude-limits.ts`, `apps/web/src/app/api/summon/route.ts:28–43` |
| Onboarding first-run wizard | The first-run gate and wizard are the very first screen a user sees. No docs describe what it asks, what happens if it is skipped, or how to re-run it. | `modules/onboarding/components/first-run-gate.tsx`, `modules/onboarding/components/first-run-wizard.tsx` |
| Search (full-text run search) | The search module exists with `search-view.tsx` and FTS5 queries. No mention anywhere in docs. | `modules/search/components/search-view.tsx`, `packages/shared/src/services/db.ts:458` |
| Multi-instance / worktrees | `AgentInstance.worktree` and the entire `worktrees.ts` service are not mentioned. The docs show roster fields but omit `cwd`, worktree creation, branch naming, and reconciliation. | `packages/shared/src/services/worktrees.ts`, `packages/shared/src/types/index.ts:95–110` |

---

## Tier 2 — Depth gaps

Features documented but shallowly — missing key details, wrong examples, or outdated info.

| Feature | Current state | What's missing | Source |
|---------|---------------|---------------|--------|
| Agent frontmatter `add-dirs` | Not listed in the frontmatter reference table | The `add-dirs` field maps to `--add-dir` flags; essential for agents that need cross-repo access | `packages/shared/src/services/agents.ts:66`, `packages/shared/src/services/summon.ts:42` |
| Agent frontmatter `room` | Not documented | Controls which "room" on the office floor the agent's desk appears in | `packages/shared/src/types/index.ts:46`, `apps/web/src/lib/validation-schemas.ts:14` |
| Session continuity / `--resume` | Docs mention `--resume <sessionId>` but not the retry: if the session is gone the app automatically retries without `--resume` | `packages/shared/src/services/runs.ts:243–268` |
| Run `exitCode` values | Docs say "130 = aborted" but do not document `-1` (server restart orphan) vs `1` (claude error) vs `0` (success) | `packages/shared/src/services/db.ts:24`, `packages/shared/src/types/index.ts:82` |
| Memory system — project memory path | Docs show `~/.claude/projects/<id>/project.md` but the actual path used by `projects.ts` stores metadata + memory together in that file; the separation between roster YAML and the memory body is not explained | `packages/shared/src/services/projects.ts`, docs `page.tsx:497` |
| Skills `permission-mode: plan` | Docs explain the three permission modes but omit the behaviour that plan mode suppresses the history note in the appended prompt | `packages/shared/src/services/agents.ts:166` |
| Summon `maxBudgetUsd` | Schema accepts it (`validation-schemas.ts:101`) and it is passed as `--max-budget-usd`; docs mention "Set a USD budget cap per run" but give no UI path or API field name | `packages/shared/src/services/summon.ts:38`, `apps/web/src/app/(app)/docs/page.tsx:604` |
| Prior context injection | Docs do not mention that `buildClaudeArgs` prepends `priorContext` (last 8 messages) when not using `--resume` | `apps/web/src/app/api/summon/route.ts:67–70`, `packages/shared/src/services/summon.ts:48` |

---

## Tier 3 — Minor features (undocumented)

Features that exist and work but are lightly used or secondary. Undocumented but lower priority.

| Feature | API path | Source |
|---------|----------|--------|
| Clipboard image paste (Wayland) | `POST /api/clipboard-image` | `apps/web/src/app/api/clipboard-image/route.ts` |
| Dev server launcher (per-project) | `GET/POST /api/projects/:id/dev` | `apps/web/src/app/api/projects/[id]/dev/route.ts` |
| Build script runner | `GET/POST /api/projects/:id/build` | `apps/web/src/app/api/projects/[id]/build/route.ts` |
| npm/pnpm/bun install trigger | `POST /api/projects/:id/install` | `apps/web/src/app/api/projects/[id]/install/route.ts` |
| Open folder in file manager | `POST /api/projects/:id/open-folder` | `apps/web/src/app/api/projects/[id]/open-folder/route.ts` |
| Process monitor | `GET /api/processes`, `GET/DELETE /api/processes/:pid` | `apps/web/src/app/api/processes/route.ts` |
| Project process logs | `GET /api/processes/:pid/logs` | `apps/web/src/app/api/processes/[pid]/logs/route.ts` |
| Git status widget | `GET /api/projects/:id/git-status` | `apps/web/src/app/api/projects/[id]/git-status/route.ts` |
| Project save/export | `GET /api/save/export?projectId=&history=1` | `apps/web/src/app/api/save/export/route.ts` |
| Project save/import | `POST /api/save/import` | `apps/web/src/app/api/save/import/route.ts` |
| Agent body history snapshots | `GET /api/agents/:id/body/history` | `apps/web/src/app/api/agents/[id]/body/history/route.ts` |
| Agent templates | `GET /api/templates` | `apps/web/src/app/api/templates/route.ts` |
| Starter agent catalogue | `GET/POST /api/starter/agents` | `apps/web/src/app/api/starter/agents/route.ts` |
| Upload attachments (agents + projects) | `GET/POST /api/agents/:id/uploads`, `/api/projects/:id/uploads` | `apps/web/src/app/api/agents/[id]/uploads/route.ts` |
| Run comparison modal | — (client-side) | `modules/runs/components/compare-modal.tsx` |
| Pipeline (multi-step chains) | `POST /api/pipeline`, `GET /api/pipeline/:id` | `apps/web/src/app/api/pipeline/route.ts` |
| Broadcast (fan-out to roster) | `POST /api/broadcast` | `apps/web/src/app/api/broadcast/route.ts` |
| Account / plan detection | `GET /api/account` | `apps/web/src/app/api/account/route.ts` |
| `.ao.json` project config | File in project root | `apps/web/src/app/api/projects/[id]/build/route.ts:65`, `dev/route.ts:66` |

---

## Tier 4 — Developer/API reference gaps

REST endpoints, SSE events, SQLite schema, CLI flags, env vars — needed by QA and integrators but documented nowhere.

| Topic | Source |
|-------|--------|
| Full REST API surface (all 54 endpoints) | `apps/web/src/app/api/**/*.ts` — no API reference exists in docs |
| SSE event schema (`attached`, `chunk`, `tool`, `usage`, `done`, `error`) | `packages/shared/src/types/index.ts:173–194`; not documented |
| SQLite schema (9 tables, 10 indexes, FTS5 virtual table) | `packages/shared/src/services/db.ts:36–166` |
| Claude CLI argv construction order | `packages/shared/src/services/summon.ts:22–49` |
| All environment variables (`AGENT_OFFICE_STARTER_DATA`, `NEXT_PUBLIC_POLL_*`, etc.) | `apps/web/src/lib/polling.ts`, `instrumentation-node.ts:31` |
| Auth / quota enforcement logic (hardCap vs warn, periodStart) | `apps/web/src/lib/claude-limits.ts`, `apps/web/src/app/api/summon/route.ts:28–43` |
| Run lifecycle state machine (running → done/error, crash recovery, `-1` exit code) | `packages/shared/src/services/db.ts:24–29`, `runs.ts:502–563` |
| JSONL→SQLite one-time migration details | `packages/shared/src/services/db.ts:181–283` |
| `buildAppendedPrompt` composition order | `packages/shared/src/services/agents.ts:147–178` |
| Validation schemas (Zod) for all POST/PUT bodies | `apps/web/src/lib/validation-schemas.ts` |
| Pipeline step graph format (`parallel` groups, `{{output}}` substitution) | `packages/shared/src/types/index.ts:198–238` |
| Worktree branch naming convention and reconciliation | `packages/shared/src/services/worktrees.ts:31`, `packages/shared/src/services/worktrees.ts:191` |
| Idle timeout (10 min) and run GC (4hr retention) | `packages/shared/src/services/runs.ts:61`, `runs.ts:80` |

---

## Already well-documented (no action needed)

| Feature | Docs location |
|---------|--------------|
| Agent file format and frontmatter fields (`name`, `description`, `default-model`, `default-effort`, `skills`, `tools`, `permission-mode`, `unit`) | `docs/page.tsx:337–397` — Agents tab |
| System prompt composition order (skills → global → project context → project memory → per-agent memory → history note) | `docs/page.tsx:378–397` — Agents tab |
| Skills system (format, installing from registry, writing local skills) | `docs/page.tsx:399–447` — Agents tab |
| Three-tier memory system (global, project, per-agent) | `docs/page.tsx:489–527` — Projects tab |
| Project metadata file format and roster instance fields | `docs/page.tsx:452–487` — Projects tab |
| Office floor navigation, status LEDs, build mode tools | `docs/page.tsx:533–578` — Usage tab |
| Run lifecycle (spawn → stream → persist → resume) | `docs/page.tsx:580–606` — Usage tab, architecture diagram |
| Run history table fields and direct SQLite query examples | `docs/page.tsx:608–648` — Usage tab |
| On-disk layout (all paths in `~/.claude/`) | `docs/page.tsx:654–675` — Reference tab |
| Architecture stack (Tauri, Next.js, better-sqlite3, Claude CLI) | `docs/page.tsx:677–716` — Reference tab |
| PATH augmentation rationale | `docs/page.tsx:708–714` — Reference tab |
| Prerequisites (Claude Code CLI install, ANTHROPIC_API_KEY) | `docs/page.tsx:219–243` — Getting Started tab |
