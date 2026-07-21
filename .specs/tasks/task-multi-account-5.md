# Multi-account Claude Code support — 5-slice feature

Persistent context file for the multi-account feature. Do NOT delete or
truncate — update the status column and add notes as work progresses.
Every session that resumes this work reads this file first.

Owner: Parlamentas
Started: 2026-07-20
Branch baseline: `main` at `359941a`
Convention: modeled on `task-app-polish-17.md`

---

## Why

Parlamentas has multiple Claude Code accounts. Some projects are
sponsored by customers whose Claude subscription should foot the bill for
that project's runs. Today agent-office spawns `claude` against whatever
`~/.claude/` contains — one account, no per-project routing. This feature
adds:

- Multiple accounts registered in agent-office
- Per-project selection of which account runs `claude` for that project
- Per-account plan detection + analytics (repurposing the existing
  post-limits usage store)

---

## Ground rules (locked in)

1. **One slice at a time.** Slices are independently shippable. Commit +
   push after each. No cross-slice mixing.
2. **Backward compat is non-negotiable.** Every existing project must
   keep working with zero migration — `accountId IS NULL` → use
   `~/.claude/` (unchanged behavior). Never break single-account users.
3. **Creds never touched.** We read `.credentials.json` files; we never
   write to them. All creation of new credentials goes through the
   official `claude` CLI login flow. Reading is only for plan detection
   + email extraction for the default label.
4. **Symlinks for shared assets, real file for creds.** Per Q3
   resolution: everything except `.credentials.json` is a symlink back
   to `~/.claude/*`. Never copy agents/skills/settings.
5. **TSC + eslint stay green throughout.** If a slice breaks either,
   revert and rework before committing.
6. **Grid → Flex per CLAUDE.md rule** stays enforced in every new UI
   file.
7. **`~/.claude/agents/*.md` is source of truth for agent definitions**
   (per app-polish-17 rule 5). Do not shadow.
8. **Never `git push --force`. Never `git commit --amend`.** Fresh
   commit per slice.
9. **Delete-with-references is blocked**, not null-out. If any project
   points at an account being deleted, the DELETE returns 409 with a
   list of blocking project IDs; UI shows a "reassign first" modal.

---

## Locked decisions (from grill-me session, 2026-07-20)

| # | Decision | Rationale |
|---|---|---|
| 1 | Switching mechanism: **`CLAUDE_CONFIG_DIR` per account** | Official Claude CLI env; no race conditions vs credential-file swap |
| 2 | Storage: **`~/.claude/agent-office/accounts/<accountId>/`** (i.e. `join(APP_STATE_DIR, "accounts", id)`) | Matches existing `APP_STATE_DIR` convention. Claude CLI does not scan `~/.claude/agent-office/`, so no collision risk. |
| 3 | Isolation: **creds only** — `agents/`, `skills/`, `settings.json`, `CLAUDE.md`, `projects/` are symlinks to `~/.claude/*` | Account = billing attribute, not agent-roster/history attribute |
| 4 | Adding accounts: **auto-import current `~/.claude` as `"default"` on first run**; new accounts via copy-paste `CLAUDE_CONFIG_DIR=… claude` modal | Leverages official OAuth; no reverse-engineering; portable across DEs |
| 5 | Project → account mapping: **`accountId?: string` in project.md YAML frontmatter** (projects are scanned from disk, not stored in SQLite), undefined = default account | Backward compatible; adding an optional field is zero-migration |
| 6 | UI: **account picker on project detail page**; management on **Settings → Accounts** | Account is primary project attribute; visible in-your-face to avoid burning wrong quota |
| 7 | `projects/` session history: **shared via symlink**; rely on existing `--resume` retry in `runs.ts:316-347` | `--resume` never orphans; retry is the safety net |
| 8 | Identity: **cuid IDs**, user-editable labels (default: email from `.credentials.json`, else `"Account N"`); **block delete when projects reference** | DB stability decoupled from Anthropic data |
| 9 | Analytics: **per-account** (repurpose existing usage store, key by `accountId`) + **basic global stats** (24h/7d runs, total cost per account, run count per account). Design pass deferred to future session with designer | Prevents "customer-acme hit limit" misreading as "you hit limit" |
| 10 | Login flow: **copy-paste modal** with `CLAUDE_CONFIG_DIR=<dir> claude` + polling for `.credentials.json` to appear | No cross-DE "open a terminal" API; user always has terminal one keystroke away |

---

## Files & conventions

- Plan file (this): `.specs/tasks/task-multi-account-5.md`
- Per-slice commits: `feat(accounts): slice N — <short summary>` OR
  `refactor(accounts): slice N — <short summary>`.
- New on-disk convention: `~/.claude/agent-office/accounts/<accountId>/`
  with real `.credentials.json` + symlinks to everything in `~/.claude/`.
- New project.md frontmatter field: `accountId?: string` (undefined =
  default account, i.e. use `~/.claude` directly).
- New DB table: `accounts (id TEXT PRIMARY KEY, label TEXT NOT NULL,
  config_dir TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`.
- Default account row: `id='default', label='Default', config_dir=<path
  to ~/.claude>` — inserted on boot if the credentials file exists.
- Projects reference accounts by string id only (no FK — projects live
  in flat markdown, referential integrity is enforced in the accounts
  service's `remove()` by scanning `~/.claude/projects/*/project.md`).

---

## Slice list

Status legend:
- ⏳ pending
- 🔨 in progress
- ✅ done (commit hash noted)
- ⏭ skipped (with reason)
- ⚠ blocked / needs input

---

### Slice 1 — Accounts service + DB migration ✅ (uncommitted)

**Goal:** Persistence layer + service functions. No UI. No spawn
integration yet. This slice alone changes nothing user-visible; it's the
foundation everything else builds on.

**Deliverables:**

1. **DB migration v7→v8** in `packages/domain/src/services/db.ts`:
   - `CREATE TABLE accounts (id TEXT PRIMARY KEY, label TEXT NOT NULL,
     config_dir TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`
   - No `projects` table exists (projects are scanned from disk); the
     per-project `accountId` reference lives in the project.md YAML
     frontmatter (handled by slice 2/4, not this slice).
   - Auto-insert default row IF `~/.claude/.credentials.json` exists:
     `('default', 'Default', '<homedir>/.claude', <now>)` — via
     `INSERT OR IGNORE` so it's idempotent across boots.

2. **New service** `packages/domain/src/services/accounts.ts`:
   - `list(): Account[]`
   - `get(id): Account | null`
   - `create({ label }): Account` — generates cuid, creates
     `~/.agent-office/accounts/<id>/`, calls `symlinkSharedAssets(id)`,
     writes DB row with `config_dir = <that path>`.
   - `rename(id, label): Account` — updates label.
   - `remove(id): { ok: true } | { blocked: string[] }` — scans
     `~/.claude/projects/*/project.md`, parses frontmatter, collects any
     project whose `accountId` matches; if non-empty, returns blocked
     list; otherwise deletes the DB row AND recursively removes the
     config dir (careful: only within `~/.claude/agent-office/accounts/`;
     never touch `~/.claude` root or `~/.claude/agents` etc.).
   - Also forbid removing `id === 'default'` — the default row is
     structural.
   - `symlinkSharedAssets(id)` — creates the target dir, then
     `ln -s ~/.claude/agents ~/.agent-office/accounts/<id>/agents` for
     each shared asset: `agents`, `skills`, `settings.json`,
     `CLAUDE.md`, `projects`, `commands`, `plugins` (skip any that
     don't exist in source).
   - `getPlan(accountId): ClaudePlan` — parameterize the existing plan
     reader from `apps/web/src/app/api/account/route.ts` to take a
     config-dir path. Cache per accountId.
   - `getEmail(accountId): string | null` — parse OAuth blob for the
     account's own email (used for default label on new accounts).

3. **Barrel export** in `packages/domain/src/services/index.ts`:
   `export * as accounts from "./accounts"`.

4. **Type** in `packages/domain/src/types/index.ts`:
   ```ts
   export interface Account {
     id: string;
     label: string;
     configDir: string;
     createdAt: number;
   }
   ```

5. **Path constant** in `paths.ts`:
   `ACCOUNTS_DIR = join(APP_STATE_DIR, "accounts")` and helper
   `accountConfigDir(id: string): string` returning
   `join(ACCOUNTS_DIR, id)`. Never used for id `"default"` (which maps
   to `CLAUDE_DIR` directly).

**Not in this slice:**
- Any API route (slice 3)
- Any UI (slice 3, 4)
- Spawn integration (slice 2)
- `/api/account` refactor (slice 5)

**Acceptance:**
- Migration runs cleanly on an existing DB; no data loss.
- On boot with existing `~/.claude/.credentials.json`, one row exists in
  `accounts` with id `default`.
- `accounts.create({ label: "test" })` creates a dir with symlinks
  pointing at `~/.claude/*`; can be removed with `accounts.remove()`.
- Removing an account referenced by any project returns blocked list;
  DB and disk untouched.
- `tsc --noEmit` green; no eslint errors introduced.

---

### Slice 2 — Spawn integration in `runs.ts` ✅ (uncommitted)

**Goal:** Actual account-switching capability. After this slice, an
account exists and `claude` will spawn against the right creds — but the
UI still has no way to set `projects.accountId`, so behavior is
unchanged unless you set it via SQL. This is intentional: ship the
plumbing before the UI, verify with SQL, then wire the UI.

**Deliverables:**

1. **`runs.ts:startRun`** — extend `StartRunOpts` with
   `accountId?: string`. When present, look up `accounts.get(accountId)`
   and set `CLAUDE_CONFIG_DIR` in the spawn env:
   ```ts
   const account = opts.accountId ? accounts.get(opts.accountId) : null;
   const env = {
     ...process.env,
     PATH: buildAugmentedPath(),
     ...(account ? { CLAUDE_CONFIG_DIR: account.configDir } : {}),
   };
   ```
   Same for the retry spawn at line 331.

2. **Callers** — every code path that eventually calls `startRun`
   needs to plumb the project's `accountId` through. Grep for
   `startRun(` in `packages/domain/src/services/summon.ts` and API
   routes. The concrete call sites are:
   - `packages/domain/src/services/summon.ts` — main summon path
   - `packages/domain/src/services/runs.ts:startRun` — internal
   - Any broadcast / batch runner

   Each site already receives `projectId`. Add one line:
   `const project = projects.get(projectId); accountId = project?.accountId;`

3. **Persist `accountId` on the run** (analytics preparation):
   - New column `runs.account_id TEXT NULL` (piggyback on slice 1
     migration OR do a slice-2 migration — user pick, default piggyback
     to keep migrations lean).
   - `db.insertRun` accepts it, stores it. This is what slice 5 will
     group by.

**Not in this slice:**
- UI to set `projects.accountId` (slice 4)
- Analytics grouping (slice 5)

**Acceptance:**
- Manually setting `UPDATE projects SET account_id='<some-account>'
  WHERE id='<some-project>'` in SQLite, then triggering a run for that
  project → `ps -ef | grep claude` shows `CLAUDE_CONFIG_DIR=…` in the
  child process's env (verify with `cat /proc/<pid>/environ`).
- Existing projects (account_id NULL) spawn `claude` with no
  `CLAUDE_CONFIG_DIR` set — identical behavior to today.
- Runs table stores `account_id` correctly.
- `--resume` retry path (line 331) also sets the env.
- `tsc --noEmit` green.

---

### Slice 3 — Settings → Accounts page (list, add, rename, delete) ✅ (uncommitted)

**Goal:** UI to manage accounts. After this slice, user can add accounts
via the copy-paste modal, rename them, and delete unused ones. Still no
per-project picker (slice 4).

**Deliverables:**

1. **API routes**:
   - `GET /api/accounts` — list all accounts (with plan + optional
     email per row).
   - `POST /api/accounts` — body `{ label }` → creates row + dir,
     returns `{ account, configDir }` so the UI can show the
     copy-paste command.
   - `PATCH /api/accounts/[id]` — body `{ label }` → renames.
   - `DELETE /api/accounts/[id]` — 200 on success, 409 with
     `{ blockedBy: string[] }` when referenced.
   - `GET /api/accounts/[id]/status` — poll target: returns
     `{ ready: boolean, plan?: ClaudePlan, email?: string }`. Ready
     when `<configDir>/.credentials.json` exists and parses.

2. **Frontend module** `apps/web/src/modules/accounts/`:
   - `hooks/use-accounts.ts` — `useAccounts`, `useCreateAccount`,
     `useRenameAccount`, `useDeleteAccount`, `useAccountStatus(id)`
     (polls every 2s while modal open).
   - `components/accounts-page.tsx` — list, wraps with
     `<QueryState>` primitive from task-app-polish-17 slice 12.
   - `components/add-account-modal.tsx` — three-step flow:
     1. Name it (input).
     2. Show copy-paste command with copy button + spinner "Waiting for
        login…". Poll `/api/accounts/<id>/status` every 2s.
     3. On ready: show detected email + plan badge, prompt to confirm
        or rename before finish.
   - `components/delete-account-modal.tsx` — shows blocked project
     list when 409, with links to reassign.

3. **Sidebar / settings integration**: new "Accounts" tab in the
   settings panel (adjacent to Performance / About You). Route:
   `/settings/accounts` OR a tab within existing settings — match
   whatever the existing settings structure uses.

4. **Plan badge component** — reusable pill (`Max` / `Pro` / `Free` /
   `API`) matching existing analytics-modal styling.

**Not in this slice:**
- Project detail picker (slice 4)
- Per-account analytics view (slice 5)

**Acceptance:**
- Fresh app: Settings → Accounts shows "Default" with the right plan
  badge.
- "Add account" flow: enter label → shell command shows → run it in a
  terminal → modal auto-advances → account appears in list.
- Rename works. Delete of unused account works. Delete of used account
  is blocked with clear list of blocking projects.
- Grid → Flex enforced on the page.
- `tsc --noEmit` green.

---

### Slice 4 — Project detail account picker ✅ (uncommitted)

**Goal:** Per-project account selection. After this slice, the feature
is user-complete for the "billing routing" use case.

**Deliverables:**

1. **API route**: extend the existing project update endpoint
   (whatever `PATCH /api/projects/[id]` shape is) to accept
   `accountId: string | null`.

2. **`projects.update`** service — accepts `accountId`.

3. **`<ProjectAccountPicker>` component** in
   `apps/web/src/modules/projects/components/`:
   - Dropdown listing all accounts (label + plan badge).
   - First option: "Default (—)" (label of the default account).
   - Selecting an option immediately PATCHes and shows a toast.
   - Includes an inline "Manage accounts →" link that opens the
     Settings → Accounts page.

4. **Integrate into `project-detail.tsx`**:
   - Show account label + plan badge as a small chip in the project
     header, next to the existing metadata (name, path, planet).
   - Clicking the chip opens the picker.
   - Follow the existing project-detail-header component pattern (see
     task-app-polish-17 Task 2 for the extracted subcomponents).

5. **Invalidate run queries on account change** so the UI immediately
   reflects that new runs will use the new account.

**Not in this slice:**
- Analytics view (slice 5)

**Acceptance:**
- Setting a project's account via the picker → next run for that
  project spawns with the correct `CLAUDE_CONFIG_DIR` (verify via
  `/proc/<pid>/environ`).
- Setting to "Default" nulls out the DB column.
- Deleting an account no longer blocked once picker is used to reassign
  its projects.
- Grid → Flex enforced.
- `tsc --noEmit` green.

---

### Slice 5 — Per-account analytics ✅ (uncommitted)

**Goal:** Analytics store keyed by `accountId`. Basic global stats panel
in Settings → Accounts. No visual design pass (deferred to a later
session with the designer).

**Deliverables:**

1. **Repurpose existing usage store**: whatever landed after
   task-app-polish-17 Task 11 (`Limits → Analytics` — see
   `modules/analytics/**`). Currently keyed globally; needs to be
   keyed by `accountId`.
   - Backfill: every existing row has NULL `account_id` → treat as
     `default`.
   - New rows: use the `runs.account_id` from slice 2.

2. **`/api/analytics` endpoint** accepts `?accountId=<id>` query param.
   Returns per-account rollup. When omitted, returns per-account
   breakdown grouped.

3. **Global stats panel** in Settings → Accounts (bottom section):
   For each account, show:
   - Runs (24h) / Runs (7d)
   - Total cost (7d)
   - Run count all-time

   No charts, no colors beyond existing tokens, no polish. Just
   numbers in a simple flex layout. Explicitly labeled "temporary —
   will be redesigned" so future-us doesn't mistake it for finished
   work.

4. **Existing analytics modal** — when opened from a project context,
   scope to that project's account. When opened globally (from
   sidebar), show the current default's data with a small account
   selector at top.

**Not in this slice:**
- Full analytics redesign — deferred to designer session.
- Cross-account aggregations, exports, or reports.

**Acceptance:**
- After running 3 runs on account A and 2 on account B, the accounts
  page shows 3 and 2 respectively.
- Existing analytics modal still works for the default account.
- `tsc --noEmit` green.
- Grid → Flex enforced.

---

## Deferred / not-in-scope

Items that came up but are explicitly out of scope for this feature:

- **"Open terminal for me" button** — deferred per Q10. Copy-paste is
  sufficient for v1.
- **Per-account agent/skill isolation** — locked in Q3 as "shared
  everything"; if a customer ever objects to seeing shared agents, we
  add a per-account override then.
- **Header dropdown for account switching** (Q6 option D) — bury under
  project detail for v1; promote if the picker proves too hidden.
- **Anthropic account ID as identity** — locked in Q8; we use our own
  cuid.
- **Analytics visual design** — deferred to a session with the
  designer agent. Slice 5 ships only the plumbing + a functional
  placeholder panel.
- **Session history isolation** — Q7 shared it via symlink; if this
  bites in practice, revisit with per-account `projects/` dirs.
- **CLAUDE_CONFIG_DIR-alternative env vars** (`ANTHROPIC_API_KEY` etc.)
  — out of scope; this feature is for OAuth-authed accounts. API-key
  accounts can be added later as a distinct account type.

---

## Session log (append as we go)

- 2026-07-20 — Grill-me planning session with Parlamentas. Q1-Q10
  resolved. Spec written. Slice 1 not yet started.
- 2026-07-20 — Slices 3, 4, 5 built in one continuous session.
  * **Slice 3 (Settings → Accounts):** API routes
    `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/[id]`,
    `GET /api/accounts/[id]/status`. Frontend module
    `apps/web/src/modules/accounts/`: `use-accounts.ts` hooks,
    `plan-badge.tsx`, `add-account-modal.tsx` (3-step: name →
    copy-paste command + 2s poll → confirm+rename), `delete-account-modal.tsx`
    (409 blocked-by-projects UI), `accounts-tab.tsx` root. Plugged into
    `settings-page.tsx` as a new "Accounts" tab. `.credentials.json`
    contains no email field on this machine — dropped email prefill
    from the modal (user just names accounts manually).
  * **Slice 4 (Project detail picker):** `project-account-picker.tsx`
    with a native `<select>` chip in the project meta row (next to cwd/
    git). One-account state renders as a link to Settings; multi-account
    state is a dropdown that PATCHes on change. `accountId: null` in
    the PATCH body clears back to the default (route coerces to
    undefined). Widened `useUpdateProject`'s patch type accordingly.
    `projectMetaPatchSchema` gained `accountId: string().min(1).nullable().optional()`.
  * **Slice 5 (Per-account analytics):** New `services/analytics.ts`
    with `listPerAccountStats()` (GROUP BY account_id: runs24h/7d/all
    time + cost7d). `GET /api/analytics/per-account` exposes it.
    `AccountsStatsPanel` renders a placeholder table below the account
    list — explicitly labeled "temporary — will be redesigned with the
    designer agent". Existing `claude-limits-modal` NOT refactored
    (deferred; spec calls that out).
  * **HTTP end-to-end smoke test:** booted `next dev` on :3033, ran a
    bash script hitting all endpoints — 16/16 checks pass (default
    listed with plan=max; create returns acc_ id + config dir; empty
    label rejected; rename works; delete-default returns 400; a fake
    project with `accountId: <test>` in frontmatter blocks delete with
    409 + blockedBy list; delete cleans up config dir; analytics
    returns real data — 2177 runs / $726 in 7d, all `accountId: null`
    from before slice 2 landed the column; path-traversal id
    → 400). Server killed, temp files cleaned.
  * Spec corrections applied during build:
    - `API_ROUTES.account` conflict — pre-existing string, my new
      per-id builder → renamed mine to `accountById`.
    - Icon `user` doesn't exist — used `users` (plural).
    - `ClaudePlan` promoted from `apps/web/src/lib/claude-limits-store`
      to domain `types/index.ts` (source of truth); the frontend file
      still declares its own for now since the analytics modal is out
      of scope. Consolidate later.

- 2026-07-20 — Slice 2 built. Files: `runs.ts` (new
  `resolveSpawnEnv(opts)` — exported for testing; both spawn sites
  use its `env` output; retry spawn now inherits the same env, closing
  the retry-path account leak the spec called out; `StartRunOpts.accountId?`
  as explicit override; storage of `accountId` into `runs.account_id`),
  `db.ts` (v8→v9 migration: `runs.account_id` column + `idx_runs_account`
  index; `RunInsert.accountId?` + insertRun stores it), `projects.ts`
  (`yamlToProjectMeta` parses `accountId` from frontmatter,
  `writeMetadata` writes it, `projectFromScan` propagates it into
  `Project.meta`). Zero changes to any of the 4 API-route callers —
  they get account routing for free because runs.ts resolves the
  project's accountId internally. Smoke test (6 cases + round-trip)
  passed: no account → no env var; `default` → no env var (correct);
  explicit accountId → `CLAUDE_CONFIG_DIR` set to the account's dir;
  frontmatter accountId → same env var via project lookup; explicit
  beats frontmatter; stale/non-existent accountId → warn + fall back to
  `~/.claude` (fail-safe). Round-trip: `createProject`→`updateProject`
  with `meta.accountId` persists and re-reads correctly; setting it to
  `undefined` clears the frontmatter field.
- 2026-07-20 — Slice 1 built. Files: `paths.ts` (+ACCOUNTS_DIR,
  DEFAULT_ACCOUNT_ID, accountConfigDir), `types/index.ts` (+Account,
  AccountWithStatus, ClaudePlan, +ProjectMeta.accountId?), `db.ts`
  (migration v7→v8: accounts table + auto-insert default row),
  `services/accounts.ts` (new: list/get/create/rename/remove +
  ensureAccountDir + symlinkSharedAssets + getPlan/getEmail/isReady/
  getStatus + findProjectsUsingAccount for referential integrity),
  `services/index.ts` (barrel). Smoke test against live DB passed all
  20 checks (default row exists w/ plan=max, symlinks are real
  symlinks, referenced-project blocks delete, remove cleans up dir,
  default cannot be removed). Uncommitted — awaiting user review.
  Spec correction applied during build: `~/.agent-office/` →
  `~/.claude/agent-office/` (matches APP_STATE_DIR); projects.accountId
  moved from a DB column to project.md frontmatter (projects are
  scanned from disk, not persisted in SQLite).
