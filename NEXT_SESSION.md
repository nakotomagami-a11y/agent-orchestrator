# Next session — agent-office

Last updated: 2026-07-20 (multi-account 5 slices built + **phantom-run-failure
bugfix**, both awaiting user test + commit)

## Required reading (in order, every session)

1. `/home/parlamentas/CLAUDE.md` — global dev-box conventions
   (Flexbox-only rule, tool preferences)
2. `.specs/tasks/task-multi-account-5.md` — **active feature**:
   multi-account Claude Code support (5 slices, none started yet)
3. `.specs/tasks/task-app-polish-17.md` — previous 17-task sweep,
   fully done; useful reference for conventions (query-state primitive,
   docs tab, analytics rename, cleanup panel)

## What was done in the 2026-07-20 sessions

**Planning session:**
- Grilled out the multi-account feature end-to-end (10 questions,
  every decision locked).
- Wrote `.specs/tasks/task-multi-account-5.md` with 5 shippable slices.

**Slice 1 build session (same day):**
- Built slice 1 — accounts service + DB migration v7→v8. Zero
  user-visible change; foundation only.
- Two spec corrections applied during build:
  1. Storage path `~/.agent-office/accounts/` → `~/.claude/agent-office/accounts/`
     (matches existing `APP_STATE_DIR`).
  2. `projects.accountId` moved from a DB column to the project.md
     YAML frontmatter — projects are scanned from disk, not stored in
     SQLite. The `accounts` table itself IS in SQLite (app-owned).
- Smoke test (20 checks) against live DB passed: default account
  auto-inserted w/ plan=`max`, symlinks are real symlinks, referenced
  project blocks delete, remove cleans up dir, default protected.

**Slice 2 build session (same day):**
- Built slice 2 — spawn integration in `runs.ts` + v8→v9 migration for
  `runs.account_id`. Zero caller changes: the four API routes calling
  `startRun` (summon, broadcast, user-analysis, pipeline) get account
  routing "for free" because `runs.ts` resolves the project's
  `accountId` internally via `readProject(opts.projectId)`.
- New export `runs.resolveSpawnEnv(opts)` — pure function returning
  `{ env, accountId }`. Both the initial spawn (line 255) and the
  `--resume` retry spawn (line 331) use this env, closing the retry
  leak the spec called out. Explicit `opts.accountId` beats project
  frontmatter; `"default"` → no `CLAUDE_CONFIG_DIR` (uses shared
  `~/.claude`); stale/missing account → warn + fall back to `~/.claude`
  (fail-safe, never fatal).
- `projects.ts` now round-trips `meta.accountId` through YAML
  frontmatter: `yamlToProjectMeta` parses it, `writeMetadata` writes
  it, `projectFromScan` propagates it. Slice 4's UI just calls
  `updateProject({ meta: { accountId } })`.
- Smoke test (6 resolveSpawnEnv cases + round-trip through
  `createProject`/`updateProject`/`readProject`) passed. DB migration
  v9 verified: `runs.account_id` column + `idx_runs_account` index.

**Slices 3–5 build session (same day, continuous):**
- **Slice 3 (Settings → Accounts):** API `GET/POST /api/accounts`,
  `PATCH/DELETE /api/accounts/[id]`, `GET /api/accounts/[id]/status`.
  Frontend module `apps/web/src/modules/accounts/`: hooks +
  `plan-badge`, 3-step `add-account-modal`, `delete-account-modal`
  (409 blocked-by-projects branch), `accounts-tab` root. Wired into
  `settings-page.tsx` as new "Accounts" tab.
- **Slice 4 (Project detail picker):** `project-account-picker.tsx`
  chip in project meta row. Native `<select>` dropdown, single-account
  state renders as a Settings link. `accountId: null` in the PATCH body
  clears back to default (route coerces to undefined).
- **Slice 5 (Per-account analytics):** `services/analytics.ts` +
  `/api/analytics/per-account` + `AccountsStatsPanel`. GROUP BY
  account_id, treats NULL as legacy/default. Placeholder visual —
  design pass deferred to designer session per spec.
- **HTTP smoke test on `next dev -p 3033`:** 16/16 checks pass across
  all API surfaces. Real analytics data returned: 2177 runs / $726
  in 7d, currently all `accountId: null` (pre-slice-2 rows).

**Phantom-run-failure bugfix session (same day, after slices):**
- User report: agent at `?instance=developer-04puplp` "stopped after some tool
  calls without giving any response". Diagnosed run
  `385ab083` → `status=error, exit_code=-1, output=''`.
- **Root cause:** `next dev` restarted at 13:40:37, 12s into a run started
  13:40:25. The new worker called `getDb()`, which ran a *blanket*
  `UPDATE runs SET status='error', exit_code=-1 WHERE status='running'` —
  killing runs owned by the **still-live old worker**. Proof: `tool_calls`
  rows for that run kept being written until 13:41:20, 28s *after* its
  `ended_at` of 13:40:52. The agent was working fine; only the bookkeeping died.
- **Second bug (the "no response at all" symptom):** in
  `api/runs/[id]/stream/route.ts`, `markRunAborted(id)` was called and then
  `failed` was computed from the **stale pre-update snapshot** (`status:
  'running'`, `exitCode: null`) → `failed === false` → the route emitted
  `done {exitCode: 0}` with no output and no error message. The "Run was
  interrupted" banner on the line below was unreachable for fresh orphans.
- **Fix:** new `runs.owner_pid` column (migration v9→v10). Orphan detection now
  asks `process.kill(pid, 0)` whether the owning process is actually gone.
  `reapOrphanedRuns()` replaces the blanket sweep; pipelines are scoped the same
  way via a `NOT EXISTS` on live child runs. `store.isRunOrphaned(id)` is the
  shared predicate, used by both the stream route and `GET /api/runs` (which had
  the identical blanket assumption in its list mapping).
- **Verified:** `db.orphan-reap.test.ts` red-green'd — with the old blanket
  behaviour the live-owned run asserts `error/-1` (exactly the user's bug);
  with the fix it stays `running`. Both `tsc --noEmit` pass (web + domain).

**Opaque-500 session (same day, after the phantom-run fix):**
- User report: same instance now shows two `Run error / Internal Server Error`
  bubbles instead of a reply.
- **Diagnosis:** `POST /api/summon` returned **500 with a zero-byte body**. No
  `runs` row and no `messages` row was written for either attempt, so the throw
  happened *before* `startRun`. `apiClient`'s interceptor falls back to
  `res.statusText` when the body has no `error` field — that is literally where
  the string "Internal Server Error" comes from.
- **Root cause:** transient. `POST /api/summon` had zero error handling, so any
  throw became Next's default bodyless 500. The failure window (13:47–14:00)
  is exactly when the previous session was still editing files the route
  imports — `packages/domain/src/services/db.ts` has mtime **13:55**. A send
  that lands while `next dev` is recompiling a half-written module 500s.
  Replaying the identical request afterwards returns 200 (verified: two A/B
  curls, both `200 {"runId":…}`).
- **Fixes (the real deliverable — the transient itself is unfixable in dev):**
  1. `api/summon/route.ts` — handler split into `POST` (try/catch) +
     `summonRun`. Any throw is now `log.error("summon.failed", {message,
     stack})` + `serverError(err.message)`, so the chat bubble shows the actual
     cause instead of "Internal Server Error".
  2. `lib/api-helpers.ts` — `tryService` now `log.error("route.failed", …)`
     before its 500. Every route using it gains the same trace.
  3. `services/log.ts` — `warn`/`error` lines are appended to
     `~/.claude/agent-office/server.log`. Previously the only copy of a server
     error was the stderr of whatever terminal ran `pnpm dev`; once that
     scrolled away the incident was unreconstructible.
- **Verified:** temporary `throw new Error("boom")` in `summonRun` →
  `HTTP 500 {"error":"boom"}` + a matching `summon.failed` JSON line with full
  stack in `server.log`. Throw removed, normal summon back to
  `200 {"runId":"3c4fec7c…"}`, `tsc --noEmit` exit 0.

## What's in flight

Uncommitted in main tree (25 paths total):

Domain (`packages/domain/`):
```
 M src/services/db.ts              (v8/v9/v10 migrations + reapOrphanedRuns/isPidAlive/isRunOrphaned)
 M src/services/store.ts           (isRunOrphaned re-export)
?? src/services/db.orphan-reap.test.ts  (new — reaper regression guard)
?? src/services/ts-resolve-hook.mjs     (new — lets plain node run domain .ts sources)
 M src/services/index.ts           (accounts + analytics barrel)
 M src/services/paths.ts           (ACCOUNTS_DIR + accountConfigDir)
 M src/services/projects.ts        (accountId in frontmatter r/w)
 M src/services/runs.ts            (resolveSpawnEnv + both spawn sites)
 M src/types/index.ts              (Account, AccountWithStatus, ClaudePlan, ProjectMeta.accountId)
 M src/config/routes.ts            (accounts + accountById + accountStatus + analyticsPerAccount)
 M src/hooks/query-keys.ts         (accounts + analytics keys)
?? src/services/accounts.ts        (new — ~200 lines)
?? src/services/analytics.ts       (new — ~55 lines, per-account rollup)
```

Web (`apps/web/`):
```
 M src/app/api/projects/[id]/route.ts        (accountId null→undefined coerce)
 M src/app/api/runs/[id]/stream/route.ts     (orphan check + stale-snapshot fix)
 M src/app/api/runs/route.ts                 (list mapping uses isRunOrphaned)
 M src/app/api/summon/route.ts               (try/catch + log.error, no more bodyless 500)
 M src/lib/api-helpers.ts                    (tryService logs before 500)
 M src/lib/validation-schemas.ts             (accountCreate/Patch + projectMetaPatch.accountId)
 M src/modules/projects/components/project-detail.tsx  (mount picker in meta row)
 M src/modules/projects/hooks/use-projects.ts (widened patch type for accountId:null)
 M src/modules/settings/components/settings-page.tsx  (new Accounts tab)
?? src/app/api/accounts/                     (GET+POST, [id] PATCH+DELETE, [id]/status GET)
?? src/app/api/analytics/per-account/route.ts
?? src/modules/accounts/                     (hooks + 4 components + panel)
?? src/modules/projects/components/project-account-picker.tsx
```

Spec/handoff:
```
?? .specs/tasks/task-multi-account-5.md      (slices 1–5 all marked ✅)
?? NEXT_SESSION.md                           (this file)
```

Live DB has been auto-migrated to `user_version = 9`:
- v8 added the `accounts` table + inserted the `default` row.
- v9 added `runs.account_id TEXT NULL` + `idx_runs_account` index.
Rolling back requires manually reversing both.

**v10 (`runs.owner_pid INTEGER`) has NOT run against the live DB yet** — it
applies the next time the dev server opens it. Rows written before v10 have
`owner_pid IS NULL` and are still treated as orphaned (old behaviour), so the
fix only protects runs started after the next restart.

## Immediate next 3-5 steps for successor

0. **Verify the phantom-failure fix live.** Restart the dev server, start a
   long agent run, then in another terminal touch `next.config.ts` (or just
   restart `next dev`) mid-run. Before the fix the run flipped to error/-1 and
   the chat went silent; after it, the run row stays `running` and the UI shows
   "owned by another server process… its result will appear in history".
   Regression test: `HOME=$(mktemp -d) node --disable-warning=ExperimentalWarning
   --import ./packages/domain/src/services/ts-resolve-hook.mjs
   packages/domain/src/services/db.orphan-reap.test.ts`
1. **User test pass** — the user said "we will test at the end once
   it's polished". Manually walk through:
   - Settings → Accounts tab: default account visible w/ `max` badge?
   - Click "Add account", enter a label, copy the shown command, run
     it in a terminal, complete browser OAuth, watch the modal
     auto-advance.
   - Open a project's detail page: the new account picker chip should
     be in the meta row next to cwd. Switch account, watch the
     `accountId` land in `~/.claude/projects/<id>/project.md`
     frontmatter, trigger a run, verify it spawns with
     `CLAUDE_CONFIG_DIR=…` set (`ps` + `/proc/<pid>/environ`).
   - Stats panel below account list should show per-account runs +
     cost totals.
   - Try to delete an in-use account: modal should show the blocking
     project list.
2. Once tested, ask the user how they want to commit — 5 separate
   `feat(accounts): slice N — <summary>` commits OR one big
   `feat(accounts): multi-account support`. **Do not commit without
   asking.**
3. After commit, update the spec's Session log with commit hashes and
   set the slice statuses to just ✅ (dropping "uncommitted").
4. **Deferred/nice-to-have follow-ups** (mention if user asks):
   - Consolidate `ClaudePlan` type — currently defined in both
     `packages/domain/src/types/index.ts` (my new copy) AND
     `apps/web/src/lib/claude-limits-store.ts` (pre-existing). The
     frontend one should re-export from domain.
   - Refactor `claude-limits-modal.tsx` to accept an `accountId` prop
     so the existing analytics modal can be scoped per-account. Out
     of scope for slice 5 per spec ("full analytics redesign — deferred
     to designer session").
   - Investigate the `rateLimitTier` field in `.credentials.json` —
     might give per-account rate-limit context worth surfacing.

## Gotchas discovered this session

- **"Internal Server Error" in a chat bubble means the 500 had no body.**
  `apiClient`'s interceptor only uses `res.data.error`; with nothing there it
  falls back to `res.statusText`. Any route that can throw must return
  `serverError(msg)` itself — an unhandled throw in an App Router handler tells
  the user nothing and (before this session) left nothing on disk either.
- **Sending a message while `next dev` recompiles = a 500.** Editing anything
  in the domain services barrel invalidates every API route that imports it.
  Not a code bug; check `~/.claude/agent-office/server.log` for
  `summon.failed`/`route.failed` before hunting for one. Retry succeeds.
- Server logs now persist to `~/.claude/agent-office/server.log` (warn+error
  only). It is never rotated — `ponytail:` truncate it manually if it grows.
- **A restarting `next dev` does not kill the agent it spawned.** The old worker
  keeps driving its `claude` child and keeps writing to the *same* SQLite file.
  Any "clean up state on startup" logic must therefore be scoped to processes
  that are actually dead — never `WHERE status='running'` alone. Same trap
  applies to any future sweep over `pipelines`, `pipeline_steps`, or worktrees.
- **`markRunAborted` mutates the row; your in-hand `PersistedRun` is stale.**
  Re-read or derive from the flag you just set. The original bug shipped a
  `done {exitCode: 0}` with an empty body because of exactly this.
- Diagnosing a "silent" agent: compare `runs.ended_at` against
  `MAX(tool_calls.ts)` for that run id. Tool calls landing *after* `ended_at`
  prove the child outlived the bookkeeping, i.e. a cross-process problem rather
  than an agent crash.
- Correction to the earlier note below about `tsx`: plain `node` *can* run the
  domain `.ts` sources — the only blocker was extensionless relative imports.
  `packages/domain/src/services/ts-resolve-hook.mjs` retries resolution with a
  `.ts` suffix; pass it via `--import`. No network install needed. `bun` is not
  an option here: it can't load the `better-sqlite3` native binding.
- `os.homedir()` honours `$HOME`, so `HOME=$(mktemp -d)` gives any test a
  completely fresh `APP_STATE_DIR`/DB without touching real user data.
- `~/.claude/.credentials.json` is read by `apps/web/src/app/api/account/route.ts`
  today; that reader is now duplicated in `accounts.getPlan(id)`. Slice 5
  should refactor `/api/account` to delegate.
- Domain package's standalone `tsc --noEmit` fails on missing `@types/node`
  because worktrees are created without `pnpm install`. Real typecheck
  runs from `apps/web` in the main tree (`node_modules` present). If a
  slice adds code across packages, always verify from the main tree.
- Node's ESM strip-types loader can't resolve extensionless TS imports
  (the way our domain package uses them). Smoke tests must use
  `pnpm dlx tsx@latest <script>` — plain `node --experimental-strip-types`
  chokes on internal imports.
- `~/.claude/skills` doesn't exist on this machine (skills live at
  `~/.claude/agents/_skills`, exposed through the `agents` symlink).
  The symlink farmer in `symlinkSharedAssets` correctly skips missing
  sources — don't "fix" this by adding `agents/_skills` to
  `SHARED_ASSETS`.
- OAuth blob email extraction returned null on my credentials — the
  actual JSON shape probably differs from `emailAddress`/`accountEmail`
  /`email`. Investigate in slice 3 when building the login modal that
  needs to prefill the label from email.
- `CLAUDE_CONFIG_DIR` isolates *everything* Claude CLI-related. Our
  design symlinks all non-cred assets back to `~/.claude/` so agents,
  skills, session history, and settings stay shared. The service's
  `symlinkSharedAssets(id)` helper is where this contract lives — get
  it wrong and either (a) a new account is empty of agents or (b) two
  accounts corrupt each other's creds.
- `runs.ts` has TWO spawn call sites (initial spawn + `--resume`
  retry). Slice 2 solved this by hoisting the env into
  `resolveSpawnEnv(opts)` at the top of `startRun`, and reusing that
  `env` object at both spawn sites. Both are covered.
- Backward compat gate: `accountId IS NULL` on projects → no
  `CLAUDE_CONFIG_DIR` set → identical to today. Never break this.
- Convention naming: task specs live at `.specs/tasks/task-<slug>-<N>.md`
  where N is the subtask/slice count. See `task-app-polish-17.md` for
  the template.

---

# Light-mode contrast + colour-drift pass (2026-07-21, `designer`)

**Status:** applied, verified end-to-end, **uncommitted**. Zero dark-mode
change (proved byte-identical, see below).

## What this was

Audit of the app in **light mode** for colour drifts and unreadable text,
plus an explicit ask to make the **modal backdrop light**. Explicitly *not*
a redesign — token/value fixes only, no layout or component restructuring.

## Method

Contrast was measured, not eyeballed. A Playwright script walks every text
node on 8 routes, composites the real effective background through
alpha/parent stacking, and computes the WCAG ratio against the AA threshold
for that font size/weight. Numbers below are from that harness.

Result, light mode, aggregate across `/`, `/projects/[id]`, `/activity`,
`/agents`, `/memory`, `/skills`, `/analytics`, `/settings`:

| | before | after |
|---|---|---|
| failing text nodes | ~1,100 | **314** (275 of them one root cause, below) |
| `/projects/[id]` | 67 | 7 |
| `/analytics`, `/settings` | 8 | 0 |

## Files changed (5)

- `apps/web/src/app/globals.css` — the bulk
- `apps/web/src/components/layout/nav-item.tsx`
- `apps/web/src/components/ui/code-editor.tsx`
- `apps/web/src/modules/agents/components/agent-list.tsx`
- `apps/web/src/modules/projects/components/add-agent-modal.tsx`

## The fixes

1. **Muted text ramp (light only).** `--txt-2/3/4` were `#6e7681 / #9ea6b0 /
   #c4c9d1` → measured **4.14 / 2.22 / 1.50**. Now `#545a63 / #5f6773 /
   #6e7682` → **6.95 / 5.72 / 4.59** on white, three visually distinct tiers.
   This alone fixed ~700 nodes (every agent slug, "Command palette", run
   prompts, sidebar labels, meta rows). `--idle` and `--ao-fg-2/3` aligned
   to match.

2. **Status ramp (light only).** `--working/#22c55e`, `--queued/#eab308`,
   `--thinking/#f97316`, `--error`, `--done` are vivid hues that scored
   **2.0–2.3:1 as text** on white. Light mode now uses darkened variants
   (`#15803d`, `#a16207`, `#c2410c`, `#dc2626`, `#166534`). **Dark mode
   re-declares the original values**, so status dots stay vivid there.

3. **Modal backdrop.** Five separate mounts each hardcoded their own
   near-black wash (`rgba(10,10,18,.55)`, `rgba(5,5,10,.78)`, a radial
   near-black gradient, `bg-black/40`). In light mode that turned the whole
   app charcoal behind a white dialog. New `--ao-backdrop` token + one
   `html:not([data-theme="dark"]) .app-modal-backdrop` rule re-points all
   five. The `data-perf` / `@supports not` **`!important`** fallbacks (which
   force a near-solid fill when blur is off — and this machine runs
   `data-perf="lite"`, so they *always* apply here) are now theme-scoped:
   light gets `rgba(226,228,233,.97)`, dark keeps `rgba(4,4,8,.98)`.

4. **Category chips, add-agent modal.** `CAT_META[].fg` are lightened tints
   for dark cards; as text on the light theme's 10% wash they measured
   **1.4–1.9:1**. Added `fgLight` (darkened mirror) + a `.cat-chip` rule that
   picks per theme. `color` had to move out of the inline style — an inline
   style outranks any stylesheet override.

5. **Department tags, `/agents`.** A *second*, separate palette
   (`categorize.ts`), same problem, **2.2–3.5:1**. Rather than maintain
   another hand-picked table, `.cat-tag` mixes the hue 68% toward black in
   light mode only.

6. **Markdown highlighter (`code-editor.tsx`).** Was a one-atom dark theme:
   `#e6c07b` code, `#79b8ff` links, plus a set of `rgba(255,255,255,…)`
   washes for fences/quotes/rules that are *invisible* on white. All moved to
   `--md-code / --md-link / --md-fence / --md-pre-bg / --md-inline-bg`, with
   the originals preserved under `[data-theme="dark"]`. Gutter fill
   (`rgba(0,0,0,.15)`, a mid-grey band on light) → `--ao-gutter`.

7. **Two real bugs found on the way:**
   - Add-agent **"Done" button**: idle branch appended `text-txt-3` by string
     concat while `text-white` stayed in the base list, so stylesheet order
     decided — white-on-`#e3e5e8`, **1.26:1**. Now built with `cn()`/twMerge.
   - **Active nav badge**: a 20% *white* wash over `--acc` lightened the pill
     to ~`#9688f7`, leaving its white label at **2.94:1**. Darkened the wash
     instead (`rgba(0,0,0,.22)`) → 6:1, and it improves dark mode too.

## Dark mode: provably unchanged

Diffed the compiled `[data-theme="dark"]` block, old build vs new:
**no token differs**. The only dark-visible change is the nav-badge wash
(item 7), which raises its contrast. Dark mode has its own pre-existing AA
misses (`--txt-3 #555`, `--txt-4 #333` are ~1.4–2.3:1) — **left alone**,
they're a deliberate look and were out of scope.

## Open decision — the accent purple (the remaining 275)

Every remaining light-mode failure is `--acc: #7c6af5`:

| case | ratio | count |
|---|---|---|
| white text on `--acc` fill (buttons, active nav) | 4.01 | 251 |
| `--acc` as text on `--acc-faint` / `--bg-2` | 2.88–3.61 | 24 |

Legible in practice, but a systematic AA miss. **Not changed — brand colour
is the owner's call.** One-line option if wanted, in `:root` only:

```css
--acc: #6a58e6;   /* already in the file as --acc-hover */
```

→ white-on-acc **5.06**, acc-as-text **4.42–4.56**; clears all 275. Darker
options: `#6250dd` (5.66) / `#5b49d4` (6.27).

The one non-accent leftover (`'empty'`, `--txt-4` on `--bg-3`, 3.64) is a
single label. A `1.00` entry in the report is a false positive — the
CodeEditor's deliberately transparent textarea caret layer.

## ⚠️ Dev-server gotcha — read before testing

The long-running `next dev` on :3000 had a **CSS pipeline stuck on a stale
build**: it recompiled TSX fine but served a byte-identical `layout.css`
(181,317 b) across edits, `rm -rf .next/cache/webpack`, and a full restart.
A sentinel rule appended to `globals.css` never appeared in the output.

**Consequence:** that server is currently in a hybrid state — new TSX + old
CSS. The new `.cat-chip` / `.cat-tag` / `--md-*` rules don't exist in its
stylesheet, so those chips render with an inherited colour. It is *not* a
code bug.

**To see this work correctly:**

```bash
rm -rf apps/web/.next && pnpm dev
```

Verification was done against a clean build (separate `distDir`, own port),
which compiled the CSS correctly — `--txt-2: #545a63`, and `ao-backdrop` /
`cat-chip` / `cat-tag` / `md-code` all present. If the stale-CSS behaviour
recurs on a normal restart, that's worth its own investigation.

## Verification performed

- Contrast harness, both themes, 8 routes, before & after.
- Compiled-CSS diff of `:root` and `[data-theme="dark"]` blocks.
- Computed-style probes of the modal in both themes (`backdropBg`,
  `dialogBg`, token values) under `data-perf="lite"`.
- Screenshots, both themes, 6 routes + modal.
- `tsc --noEmit` → 0 errors. ESLint on the 5 files → 0 errors (10 pre-existing
  `max-lines` warnings).
- Broke `nav-item.tsx` mid-session (JSX comment in a ternary slot → app 500s);
  caught it, fixed it, re-verified 200. Worth noting because it briefly took
  the user's running app down.

## Not done / next

- Accent decision above.
- Dark-mode muted-text ramp (pre-existing, deliberate, out of scope).
- `code-block.tsx` keeps a hardcoded `#1c1714` surface with white-alpha text
  — intentional terminal look in both themes, left alone.

---

# Analytics: modal → page, rebuilt (2026-07-21, `designer`)

**Status:** built, verified on a clean build, **uncommitted**.

## Why

User: *"currently it stinks of AI design"*. Correct, and it wasn't only cosmetic
— the old modal reported sums but hid the actual story.

### The tells (all in the old `claude-limits-modal.tsx`)
- Three equal-weight stat boxes, each tinted an arbitrary colour (`--acc`
  runs / `--done` tokens / `--queued` cost) that carried no meaning.
- A decorative 3×14px accent tick before every heading.
- `"this week"` printed three times while a segmented control already said
  *Weekly*.
- Bars that encoded nothing: a permanently-100% bar for the top model; a
  bar **and** a % **and** a cost in the agents list, degenerating into a
  column of `0%` at the tail.
- Letter avatars (D/O/D/A) where every other surface uses the real sprite.
- ~250px of dead space under "By model" — a 2-row panel locked into a 50/50
  split with a 6-row list.
- `1 runs`; "All time" wrapping onto two lines; two `display:grid` layouts
  against the Flexbox-only house rule.

### The real failure
`runs.model` mixes short aliases (`opus`) with full ids (`claude-opus-4-7`),
so Opus rendered as **four separate rows** that each looked small.
Consolidated it's **1,136 runs / $3,167 — half the runs, 80% of spend, ~4.2×
Sonnet's cost per run.** The old page made that invisible.

## What was mined from the DB

`runs` had a lot the old view ignored. Confirmed against the live DB
(2,285 runs / 59 active days):

| signal | value | was shown? |
|---|---|---|
| agent runtime (`dur_ms`) | 298 h | no |
| success rate (`status`) | 86.3% | no |
| token in/out split | 10.1M in / 20.2M out | no (total only) |
| per-project spend (`project_id`) | 18 projects | no |
| tool usage (`tool_calls`) | 71,915 calls / 22 tools | no |
| hour × weekday rhythm (`started_at`) | strong nocturnal peak | no |
| error rate per agent | 2%–22% | no |

## Shipped

**Route:** `/analytics` (page). Sidebar item now navigates instead of opening
a modal; the modal is unmounted.

**New files**
- `packages/domain/src/services/analytics-page.ts` — one SQL aggregation pass:
  totals, previous-window totals (deltas), model families, agents, projects,
  tools, 7×24 activity, gap-filled time series (day buckets ≤70d, week beyond).
- `apps/web/src/app/api/analytics/page/route.ts` — single round trip; the page
  shows all panels at once so fanning out would only add waterfalls.
- `apps/web/src/modules/analytics/` — `hooks/`, `format/`, and components:
  `analytics-page`, `hero-band`, `spend-trend`, `model-split`, `agent-table`,
  `rank-bars`, `activity-heatmap`, `panel`.
- `apps/web/src/app/(app)/analytics/page.tsx`.

**Modified** — `globals.css` (analytics palette + `--an-muted`), `sidebar.tsx`
(nav item, `LimitsNavButton` deleted), `(app)/layout.tsx` (modal unmounted),
`command-palette.tsx` (the "Spending Limits" entry called `setOpen` on an
unmounted modal — a palette action that silently did nothing; now navigates),
`modal-url-sync.tsx` (dead `?modal=limits` branch removed), plus `routes.ts` /
`query-keys.ts` / `services/index.ts`.

### Design decisions worth keeping
- **Answer-first hero.** One large number (cost) + period-over-period delta,
  with runs / runtime / success / $-per-run on a supporting rail. Replaces
  three co-equal tinted boxes that implied "tokens" matters as much as spend.
- **Model families consolidated**, sorted by spend, `$/run` promoted to a
  first-class figure. The "priciest per run" callout requires ≥10 runs so a
  3-run model can't win on noise.
- **Semantic model hues** — warm = expensive, so the stacked share bar reads
  before you reach the numbers.
- **Activity heatmap** scales intensity to the 92nd percentile, not the max,
  or one runaway hour flattens everything else.
- **Agent bars use a sqrt scale** — linear collapsed everyone below the
  runner-up into an indistinguishable stub.
- **No chart library.** Bespoke SVG (~120 lines). Chartist/Recharts ship
  default tooltips, fonts and axis chrome that fight this app's dense mono
  look — generic chart styling is itself a "template" tell. Zero bundle cost.
- **Every panel is content-height.** Models is full-width precisely so it is
  never forced to match a taller neighbour.
- **`--an-muted`**, a page-scoped micro-label tier. The global `--txt-3`/`-4`
  are tuned for light mode; in dark they are 2.3:1 and 1.4:1, unusable for
  the 9.5px labels this page is built from.

## Verified

- Contrast audit (same harness as the light-mode pass), on the analytics page:
  **light 0 failures / 250 text nodes**, **dark 1**. The one dark failure is
  the shared `PageHeader` subtitle using the app-wide dark `--txt-3` —
  pre-existing, affects every page, deliberately left alone.
- Screenshots both themes, plus the 7-day window (short series, live deltas,
  2 model cards) to confirm the layout adapts.
- API smoke-tested all-time and bounded: model folding correct, `hasPrevious`
  false for all-time / true for bounded, granularity flips day→week at 70d.
- `tsc --noEmit` 0 errors. ESLint 0 errors (14 pre-existing `max-lines` warnings).
- Live app still 200 on `/`, `/analytics`, `/projects/[id]`, `/agents`.

## ⚠️ Same dev-server CSS staleness

The running `next dev` again served a byte-identical `layout.css` after the
`--an-*` tokens were added, so the charts rendered colourless until verified
on a clean build (separate `distDir`, own port — that compiled correctly).
**`rm -rf apps/web/.next && pnpm dev` to see it properly.** This is now the
second occurrence; worth its own investigation.

## Not done / next

- `--acc` contrast decision from the previous pass is still open (white-on-acc
  4.01; `--acc: #6a58e6` in `:root` clears it).
- Old `modules/limits/` is now only reachable via `claude-limits-store`, which
  **is still live** (rate-limit-card, office quota ring, `/api/account`).
  `claude-limits-modal.tsx` + `use-analytics-summary.ts` +
  `/api/analytics/summary` are dead and can be deleted once you're happy with
  the new page.
- Possible follow-ups: project filter on the page, per-account breakdown
  (`/api/analytics/per-account` exists and `AccountsStatsPanel` is still the
  placeholder the multi-account spec deferred), click-through from a heatmap
  cell or agent row into filtered `/activity`.

---

## 2026-07-21 — agent strip status is now project-scoped

**File:** `apps/web/src/modules/office/components/agent-details/index.tsx`

- `useOfficeAgents()` derives `agent.status` from **all** runs regardless of
  project, so an agent busy on lumafriend showed a green pulsing dot in the
  agent-office modal strip.
- Added `projectRunsQ = useRuns({ projectId: activeProjectId, limit: 100 })`
  + `projectStatus(agentId)` helper (`statusFromRuns` over project-scoped runs).
  Left strip dots and the header status dot both use it now.
- Global `useOfficeAgents` status left untouched — the isometric office view
  is intentionally cross-project.
- Still global: `InstanceOverview` passes `agent.status` for every instance
  card (should be per-instance `statusFromRunsForInstance`). Not touched.

Verified: `tsc --noEmit` exit 0; `/api/runs?project=agent-office` returns only
`developer` running vs `developer,orchestrator` globally.

---

## Correction + root cause: the "half the styles are missing" report

User reported `/analytics` looking unstyled. It was, and the cause was **not**
the page — it was this workspace's recurring stale-Tailwind state.

### What was actually wrong
The live server was serving `layout.css` at **186,596 bytes**, written 14:00,
while `globals.css` had been edited at 14:39. Measured against that stylesheet:

- **29 of the 96 arbitrary utility classes** the page uses were **absent** —
  every class *unique to the new page* (`text-[38px]`, `basis-[104px]`,
  `h-[190px]`, `min-w-[380px]`, `tracking-[0.09em]`, `text-[var(--an-muted)]`…).
  Classes that already existed elsewhere in the app (`gap-[16px]`, `px-[18px]`)
  were present, which is exactly why it looked *half* styled.
- The whole `--an-*` palette was missing, so charts and bars had no colour.

### Root cause — confirmed by experiment
Not "new directories aren't watched". A novel class added to an **existing,
already-watched file** (`nav-item.tsx`) also produced **zero** CSS rebuild —
byte-identical output. The Tailwind/PostCSS step in a long-running `next dev`
here simply **stops emitting CSS entirely** while TSX continues to compile
fine. Tailwind `^4.3.0` via `@tailwindcss/postcss`.

**Only a dev-server restart clears it.** `rm -rf apps/web/.next && pnpm dev`.

### ⚠️ Retracted finding
An earlier note in this file claimed Tailwind arbitrary values like
`flex-[3_1_440px]` / `basis-[calc(...)]` are "silently dropped in this project"
and must be replaced with inline styles. **That was wrong** — it was this same
staleness, diagnosed on a stale server. Verified on a clean build: they all
compile correctly, including `[&>*]:basis-[calc(33.333%-7px)]` (Tailwind
normalises it to `calc(33.333% - 7px)` in the output, which is why a naive
grep for the escaped selector misses it). **Do not add inline styles to work
around this.**

### Inline styles removed (house rule)
The analytics module now inlines **no colour or token values at all**. Added to
`globals.css`: `.an-fill-*` (model/agent fills), `.an-rank-acc|tool` with
`.an-rank-rule` / `.an-rank-wash`, and `.an-heat-0..5`. `modelColor()` became
`modelFillClass()`. `RankBars`' `tint` prop is now `"acc" | "tool"`, not a
colour string.

Bonus: the heatmap is now **quantised to the six steps its legend advertises**
instead of a continuous `color-mix` per cell — the legend was previously
claiming discrete buckets that didn't exist.

The only remaining `style={{}}` uses are four per-datum geometry values (three
bar widths and the trend tooltip's `left`), which cannot be expressed as
classes.

### Verified on a clean build (port 3009, own distDir)
All previously-missing classes present; `--an-*` and `.an-*` rules present;
light + dark screenshots identical to the pre-refactor version; no console
errors; `tsc` 0 errors; ESLint 0 errors.

**Not restarted** — `orchestrator` and `developer` were mid-run on `lumafriend`
and the `:3000` server is also this session's parent process. User will restart
once those finish.

---

# Project-account-picker: custom dropdown (2026-07-22, `developer-lite`)

**Status:** built, verified, **uncommitted**.

## Why

User pointed at the account picker chip on the project detail page (the
"Default · max" / "LumaFriend · free" control) — it was a native `<select>`,
so its open dropdown list rendered with unstyled browser chrome instead of
the app's dark theme.

## What changed

- Found an existing, already-built-but-unused `DropdownMenu` component at
  `apps/web/src/components/ui/dropdown-menu.tsx` — themed, keyboard-nav
  (arrow keys/Enter/Escape), click-outside close. No new component created.
- `project-account-picker.tsx`: swapped the `<Select>` (native) for
  `<DropdownMenu>`. Each `DropdownItem.label` renders the account label +
  its `PlanBadge` inline. `align="start"` keeps it left-aligned like the old
  select.
- `dropdown-menu.tsx`: added one new optional prop, `triggerClassName`, so
  callers can override the default 24px/12.5px button sizing (via `cn()`,
  passthrough already used elsewhere in the codebase). Account picker uses
  it to keep the compact 22px/11px chip sizing the row already had. Only
  this file + the picker were touched — `DropdownMenu` has no other
  consumers yet, so this is additive, not a behavior change for anyone else.

## Verified

- `pnpm --filter web exec tsc --noEmit` → 0 output (clean).
- `pnpm exec eslint src/modules/projects/components/project-account-picker.tsx
  src/components/ui/dropdown-menu.tsx` → 0 errors, 2 warnings (both
  pre-existing `max-lines-per-function` style warnings, not introduced by
  this change — `ProjectAccountPicker` was already close to the 50-line cap).
- Did NOT visually screenshot the open dropdown in a running browser — no
  dev server verification was done this session. Next session (or the user)
  should open a project with 2+ accounts configured and confirm the open
  menu looks right and click-through/keyboard nav works.

## Next steps

1. Visual check: run `next dev`, open a project that has 2+ Claude accounts
   configured (Settings → Accounts), confirm the dropdown opens styled
   (dark bg, themed border) instead of native chrome, and that selecting an
   item PATCHes the project and updates the chip.
2. If it looks right, this + the other uncommitted work in this file is
   ready for the user to review/commit together (nothing was committed by
   this session, per policy).
3. No other pattern in the codebase called `<Select>` for a stylable list of
   options — if more native selects turn out to need this same treatment,
   `DropdownMenu`'s `triggerClassName` prop is now available to reuse.

## Gotchas

- `DropdownMenu` still has zero other consumers as of this session — it was
  dead code before this change. Confirm eslint/tsc pass again after any
  future edits to it since there's no existing usage to catch regressions
  by example.
- Dropdown items are plain buttons inside a `role="menu"` div, not a native
  `<select>` — no `<option>` semantics, so anything depending on native
  select behavior (form submission via native select value, screen-reader
  select semantics) would need a different approach. This is a menu-style
  picker, matching how the codebase already builds other dropdowns... except
  there were no other consumers, so this is actually the first real one.

## Follow-up in the same session: fix clipping

User reported (with screenshot) that the newly-open menu was **clipped** —
cut off partway down, second item barely visible. Root cause: the account
picker sits inside the project-detail hero card
(`project-detail.tsx` line ~200,
`className="relative overflow-hidden border ... rounded-lg"` — needed for
the ambient gradient bleed). `DropdownMenu`'s panel was `position: absolute`
inside that ancestor, so `overflow-hidden` clipped it — this is exactly why
native `<select>` popups don't have this problem (they render as a
browser-level overlay, immune to ancestor overflow).

**Fix:** mirrored the existing `Tooltip` component's pattern (same file
family, `components/ui/tooltip.tsx`) — portal the menu to `document.body`
(reused the existing `components/ui/portal.tsx` `<Portal>`, not a new one)
and position it with `position: fixed` computed from
`triggerRef.getBoundingClientRect()` on open. Closes on scroll/resize (same
as `Tooltip`) since a fixed-position portal doesn't auto-track its trigger
moving. Click-outside detection needed no change — `menuRef.contains()`
checks the real DOM tree, which portals don't affect.

**Verified:** `tsc --noEmit` clean; `eslint` on `dropdown-menu.tsx` → 0
errors, 1 pre-existing-class `max-lines-per-function` warning (function
grew from 86→106 lines because of the added positioning effect — no other
warnings introduced). **Not re-screenshotted** — same caveat as above, next
session/user should visually confirm the menu now renders unclipped, below
the trigger, right-edge- or left-edge-aligned per `align`, and still closes
on outside click / Escape / scroll.

## Third follow-up: docs callout ("NOTE" boxes) rounded corners removed

User attached a screenshot of the `[!NOTE]` callout on the `/docs` page —
the box's rounded corners on the left border made the 3px accent border
look like a curved bracket/parenthesis instead of a straight edge.

Found the renderer: `packages/ui/src/docs-render.tsx`, `Callout()` — one
shared component used for all 5 kinds (`note`/`tip`/`important`/`warning`/
`caution`), all going through the same `rounded-[8px]` class. Removed that
one class; border/background colors per-kind untouched.

**Verified:** `packages/ui` has no lint script; ran `npx tsc --noEmit`
directly inside `packages/ui` → clean (0 output). Also re-ran
`pnpm --filter web exec tsc --noEmit` (web consumes this package via
`@agent-office/ui/docs`) → clean.
**Not re-screenshotted** — next session/user should open `/docs`, land on
any file with a `[!NOTE]`/`[!TIP]`/etc. block, and confirm the left border
is now a straight edge with no curved corners top/bottom.

## Fourth follow-up: pin agents in the roster

User first asked for a **drag-to-resize divider** between the sidebar nav
list and the Roster list (plus a scrollbar on the nav block). **Refused** —
no resizable-pane pattern exists anywhere in this codebase to mirror (no
`react-resizable`-style dep, no `cursor-ns-resize` usage, nothing), and it
needed real judgment calls (persistence location, min/max clamp, drag
lifecycle) that are out of `developer-lite` scope. Handed back for a senior
`developer` dispatch — not built.

User's fallback ask: **"at least do ability to pin agents."** This one had
an existing pattern to mirror, so it was in scope:

- Found a `pinned`/`togglePin` pattern already built in
  `modules/office/components/cards-office.tsx` (Office grid view) — but it's
  ephemeral local `useState<Set<string>>`, resets on remount.
- Instead mirrored the **better-fit, already-persisted** pattern in the same
  `Sidebar` component: `useOfficeStore`'s existing `expandedGroups: Record<
  projectId, agentId[]>` (zustand `persist` middleware, localStorage-backed).
  Added a parallel `pinnedGroups` field + `togglePin(projectId, agentId)`
  action, added to `partialize` so it survives reloads — same shape, same
  store, zero new abstractions.
- `roster-group.tsx`: new optional `pinned`/`onTogglePin` props. Pin icon
  next to the agent name when pinned (same `Icon name="pin"` used in
  cards-office); a hover-reveal pin/unpin button in the row's right section,
  same visual language as the existing spawn/remove icon buttons in that
  row (`Tooltip`, 20px round button, `opacity-0 group-hover:opacity-100`).
- `sidebar.tsx`: reads `pinnedGroups`/`togglePin` from the store,
  `visibleGroups` now stable-sorts pinned groups to the top (identical
  partition-sort idiom `cards-office.tsx` already uses), passes
  `pinned`/`onTogglePin` down to each `RosterGroup`.

**Scope cut (said out loud, not silently):** only wired pinning into the
*grouped* roster (the mode shown in the screenshot, active when a project is
selected — `RosterGroup`). The flat fallback list (`RosterEntry`, used when
no project is active) was left untouched — no screenshot or ask covered
that mode, and `pinnedGroups` is keyed by `projectId` which doesn't exist
there anyway.

**Verified:**
- `pnpm --filter web exec tsc --noEmit` → clean.
- `eslint` on the three touched files → 0 errors. 7 warnings, all
  pre-existing `max-lines-per-function`/`max-lines` style warnings on
  functions/files that were already over the soft limit (grew a few lines
  from the added code, no new warning categories). One warning I did
  introduce (`react-hooks/exhaustive-deps` on a new `pinnedIds` derivation)
  was fixed immediately by wrapping it in its own `useMemo` — confirmed gone
  on re-run.
- **Not visually screenshotted** — next session/user should open a project
  with 2+ agents in the roster, hover a row to see the pin button appear,
  click it, confirm the row jumps to the top of the group list and the pin
  icon shows next to the name, and confirm it survives a page reload
  (localStorage `office-view` key).

## Gotchas (new)

- `.ag-row` (the roster group row, in `globals.css`) uses **CSS Grid**
  (`grid-template-columns: 30px 1fr auto`) — this violates the house
  Flexbox-only rule in `/home/parlamentas/CLAUDE.md`. Pre-existing, not
  introduced by this session, left alone as out-of-scope for a pin-feature
  diff. Worth a dedicated cleanup pass if a `developer` session picks up
  the sidebar again.
- Pin state lives in the *same* zustand-persisted store as roster-group
  expand/collapse state (`office-view` in localStorage) — if that store's
  schema ever needs a migration/version bump, `pinnedGroups` needs to move
  with it.

## Fifth follow-up: single-instance row hover buttons squeezed the name

User: single-instance roster rows (pin/spawn/remove) were reserving grid
space at all times (even invisible via `opacity-0`, which still occupies
layout space), so longer agent names got ellipsis-truncated —
worse once hovered, since the pin button I'd just added made it worse.
Screenshot showed "Agent Archi..." truncated with 3 hover icons squeezed in.

Found the exact fix pattern already in the codebase, one file over:
`roster-instance-row.tsx`'s `.ses-actions` (in `globals.css`) — the nested
session rows already solve this by making their hover action buttons
`position: absolute`, overlaying on top of the row instead of reserving
grid-column space.

**Fix in `roster-group.tsx`:**
- `.ag-row` div gets `relative` (Tailwind utility, not a CSS file edit —
  `.ag-row` had no `position` set, same role as `.ses`'s `position: relative`).
- Single-instance mode's action cluster (pin + spawn + remove) moved out of
  the grid-flow "Right section" div into a new sibling
  `absolute right-[6px] top-1/2 -translate-y-1/2` div — same coordinates
  `.ses-actions` uses (`right: 6px`, vertically centered). Multi-instance
  mode's count badge + expand chevron are **left untouched, in-flow** —
  those are permanent controls, not hover-only, same distinction
  `.ses-actions` draws (it doesn't touch the cost text's grid column either,
  cost is always visible; only rename/delete overlay on hover).
- Extracted a small in-file `PinButton` component since the pin button now
  appears in two branches (multi vs. single) with identical markup —
  avoids duplicating the pinned/unpinned class logic twice.

**Verified:**
- `tsc --noEmit` → clean.
- `eslint roster-group.tsx` → 0 errors. 2 warnings, both pre-existing
  `max-lines`/`max-lines-per-function` categories (157/50 and 235/200 —
  actually *fewer* lines than right after the pin-button duplication,
  before the `PinButton` extraction knocked it back down).
- **Not visually re-screenshotted.** Next session/user: open a project with
  a long agent name in a single-instance roster row, confirm the name no
  longer truncates at rest, and confirm hovering shows pin/spawn/remove
  floating on top-right without shifting the name.

---

## 2026-07-22 — in-app Claude sign-in (kills the terminal `/login` step)

**Problem:** runs failed with `Failed to authenticate: OAuth session expired…`,
shown as raw red error text; only fix was `claude auth login` in a terminal.

**Solution (feature B):** in-app re-auth. Server spawns `claude auth login
--claudeai` under the account's `CLAUDE_CONFIG_DIR`, captures the OAuth URL,
accepts a pasted code, detects success (exit 0 or "Login successful").

New/changed files:
- `packages/domain/src/services/account-login.ts` — login process registry
  (start/submitCode/getState/cancel), HMR-safe global map, 5-min timeout.
- `services/index.ts` — export `accountLogin`.
- `apps/web/src/app/api/accounts/[id]/login/route.ts` (POST/GET/DELETE)
  + `.../login/code/route.ts` (POST {code}).
- `config/routes.ts` accountLogin/accountLoginCode; `query-keys.ts` accounts.login.
- `types/index.ts` PersistedRun.accountId; `db.ts` rowToRun maps account_id.
- `modules/accounts/hooks/use-account-login.ts` — start/submit/poll(1.5s)/cancel.
- `modules/accounts/components/sign-in-panel.tsx` — reusable login body
  (auto-opens OAuth page, paste field, success/err states).
- `modules/accounts/components/sign-in-modal.tsx` — ModalShell wrapper.
- `modules/summon/components/message-bubble.tsx` — `isAuthError()` +
  `AuthErrorCard` (yellow "Sign-in required" card, Sign in → SignInModal for the
  active project's account, on success auto-retries the failed message).
- `add-account-modal.tsx` — waiting step now uses SignInPanel (no more
  "run this command in a terminal"). Removed copy-command UI.

Verified: web + domain `tsc --noEmit` exit 0. Live server: POST login →
`awaiting-code` + real OAuth URL; DELETE cancels (no lingering proc); code
endpoint 400 (no code) / 500 (no session); default creds untouched.

Note: the CLI on this machine can self-complete login via the OS keychain
(exit 0 with no code) — the success path handles both keychain and paste.

Gotcha: the previous task's project-scoped status edit in
`office/components/agent-details/index.tsx` appears to have been reverted by a
linter/user between sessions — re-check if that behavior is wanted.
