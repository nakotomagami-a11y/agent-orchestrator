# App polish — 17-task sweep

Persistent context file for the multi-task sweep the user requested. Do NOT
delete or truncate — update the status column and add notes as work
progresses. Every session that resumes this work reads this file first.

Owner: Parlamentas
Started: 2026-07-13
Branch: `main`

---

## Ground rules (locked in)

1. One task at a time. No multitasking. Commit + push after each task.
2. Agent-collaboration policy:
   - Every task with a diff → `qa-code-review` on the diff before commit.
   - Every UI task → `qa-visual` at `http://localhost:3000` after the diff lands.
   - Tasks 9 and 15 (network / destructive) → additionally `qa-pen-testing`.
   - Task 17 = whole-repo run of the "Refactor code base" workflow authored in task 13.
3. Structural-warning debt (201 max-lines-per-function / max-lines etc.
   remaining from prior session) — fix the warnings whose file overlaps with
   the task we're currently touching, don't hunt them independently during
   this sweep.
4. TSC must stay green throughout. If a task breaks TSC, revert and rework
   before committing.
5. `~/.claude/agents/*.md` is the source of truth for agent definitions —
   whenever an agent's memory/prompt/skills need editing, do it there.
6. Never `git push --force`. Never `git commit --amend`. Every task = a fresh
   commit.
7. All Grid → Flex per CLAUDE.md rule stays enforced.

---

## Deferred / resolved-by-default questions

| # | Question | Resolution |
|---|---|---|
| 1 | Planet baseline for 3× | Detail-view current size (~40 px) → target ~120 px |
| 4/5 | Agent-details from Add-Agent modal — tabs? edit? | All 4 tabs identical to existing details modal, with edit enabled. A "Details" button on each Add-Agent row opens it. |
| 7  | Hard cap uncircumventable | Yes — hard cap stays enforced; soft cap gets "Ignore & continue". |
| 8  | Skills scan mode | Detect `.md` files in this priority: `skills/*.md` → `.claude/skills/*.md` → `README.md` → any repo-root `*.md`. Show user a checklist preview before install. Skip `.git`, `node_modules`, `dist`, `build`, `.next`, `_legacy`. |
| 9  | Skills download dir | `~/.claude/skills/<repo-slug>/` |
| 10 | Update-badge location | Top bar (titlebar area) — next to Dev button — shows count + dropdown listing available updates |
| 11 | Charts lib | `chartist` (user preference stated). |
| 12 | Analytics link label | Rename sidebar "Limits" → "Analytics" |
| 13 | QueryState primitive | Yes — build `<QueryState result={q}>{({data}) => …}</QueryState>` on top of react-query + ts-pattern. |
| 14 | Workflow shape | Single ready-to-run prompt strings for now (multi-step later if needed). |
| 15 | Agent-authored docs location | `~/.claude/agent-office/docs/<agent-id>/<slug>.md` with YAML frontmatter (`category`, `title`, `created`, `updated`). Memory page gets a new "Docs" scope. |
| 16 | About-You prompt rewrite | Rewrite the `user-analyst` agent prompt using help from `agent-architect` + `cs-content-creator`. Improve frontend rendering. Regenerate button spawns as a normal run. |
| 17 | Warning-cleanup strategy | Fix warnings in files touched by this sweep as we go, don't chase the rest. |

---

## Files & conventions

- Plan file (this): `.specs/tasks/task-app-polish-17.md`
- Per-task diffs committed as: `feat(polish): task N — <short summary>` OR
  `refactor(polish): task N — <short summary>` (depending on scope).
- New unified-docs location: `~/.claude/agent-office/docs/<agent-id>/*.md`
- New skills-cache location: `~/.claude/skills/<repo-slug>/`

---

## Task list

Status legend:
- ⏳ pending
- 🔨 in progress
- ✅ done (commit hash noted)
- ⏭ skipped (with reason)
- ⚠ blocked / needs input

---

### Task 1 — Fix white background bleed in office view ✅ dcaa28e

**Resolution:** the browser-mode "reset inset:0" CSS rule targeted the old
grid class on GnomeWindow (`.[grid-template-rows\:38px_1fr]`) which was
removed during the earlier Grid→Flex sweep. Gave GnomeWindow a stable
`.gnome-window` class, updated the selector, and set `html/body` to
`var(--bg-0)` so any transparent child can't leak the browser default.
Files: `components/layout/gnome-window.tsx`, `app/globals.css`.

**Symptom (screenshot 1):** a white/light rectangle is visible between the
sidebar and the isometric map canvas.

**Root cause hypothesis:** `--bg-elev: #ffffff` (light-theme default) is
being applied via a class or inline style that never receives a dark-theme
override. Suspect containers: `OfficeShell`, page wrapper under
`/(app)/office`, or a `Card` with default bg. Confirm by inspecting the DOM
tree tonight during the fix.

**Files:**
- `apps/web/src/app/globals.css` (theme vars)
- Any container in the office route

**Acceptance:**
- No white/light rectangle visible on any page in dark mode.
- Light-theme rendering unaffected.
- `qa-visual` confirms via screenshot at `/office`.

---

### Task 2 — Project view refit ✅ e24eb78 + description fills

**UI change** (committed): planet 56 → 168 (3×), counters moved to
top-right of the name row (next to planet), description shows a
prominent "Add a description" pill when empty and becomes a textarea
when editing.

**Descriptions filled** in `~/.claude/projects/<id>/project.md`:
- `agent-office` — this IDE
- `arturasdigital` — Arturas's portfolio
- `carhub` — car marketplace
- `inwhite` — Payload CMS + Next.js ecommerce
- `vitejs-vite-apad2c3c` — Vite starter scaffold

**Still need user input** (no cwd data, unknown purpose):
- ai-tools-catalog, ai-vehicles-search, bg-fe-assignment-private,
  bg-fe-assignment, business-research, cv-scanner, demo-project,
  flaindeetattoo, inwhite (in project store — need verify), job-board,
  LandlordOS, mcp-catalog, nuomok, pixel-planets-generator,
  trading-bots
- User can fill these inline in the app now (the new "Add a
  description" button on each project detail page).

**Changes:**
1. Planet in detail header: `size={40}` → `size={120}` (3×).
2. "N agents · N runs" counter block: move to the right of the project
   NAME (next to planet), NOT under it.
3. Project description:
   - If empty → show "No description" placeholder + inline edit button.
   - Existing projects: pre-fill via a small agent run (`content-creator`)
     that reads the project name + cwd README (if any) and proposes 1-line
     descriptions.
4. Fix warnings in `project-detail.tsx` (496-line function) while there —
   extract header, activity block, memory panel, git ops block into
   subcomponents.

**Files:**
- `modules/projects/components/project-detail.tsx`
- new `project-detail-header.tsx`, `project-detail-memory.tsx`, etc.
- `packages/domain/src/services/projects.ts` (description generation)

**Acceptance:**
- Planet visibly 3× larger.
- Counters render on the right of the project name.
- Description always populated (either user-authored or generated).
- Editing description works, persists.
- `qa-visual` snapshot matches.

---

### Task 3 — Format agent names in Add-Agent modal ⏳

**Change:** Every place `agent.name` is shown as a raw slug in
`add-agent-modal.tsx`, wrap with `formatAgentDisplayName()`. Show slug as
subtle secondary text below.

**Files:**
- `modules/projects/components/add-agent-modal.tsx`

**Acceptance:** `cs-boardroom` renders as "CS Boardroom" (whatever the
formatter emits app-wide).

---

### Task 4 — Reusable Agent Details modal + wire into Add-Agent ⏳

**Changes:**
1. Extract the existing modal body (`AgentDetailsModal` in
   `office/components/agent-details/index.tsx`) into a fully props-driven
   `AgentDetailsView` component with 4 tabs
   (Conversation / History / Memory / Settings) — no dependency on the
   `useOfficeStore` for selection.
2. Existing "office" details modal continues to work by feeding
   `AgentDetailsView` from its store.
3. Add-Agent modal: each row gets a small `[i]` / "Details" ghost button.
   Clicking it opens a portal-rendered modal wrapping `AgentDetailsView`
   for that agent (with a small "Add to office" CTA at the bottom).
4. Settings tab remains editable — clicking "Save changes" persists to
   `~/.claude/agents/<id>.md` as it does today.
5. Fix warnings in `settings-tab.tsx` (SettingsForm 470-line function) by
   finally extracting `SettingsForm` into its own file with per-section
   sub-components.

**Files:**
- new `agent-details-view.tsx`
- `office/components/agent-details/index.tsx` (thin wrapper now)
- `projects/components/add-agent-modal.tsx` (add Details button)
- `settings-tab/settings-form.tsx` (new)

**Acceptance:** From Add-Agent modal, clicking Details opens a modal
identical in look to the office details modal, all 4 tabs visible, edit
works.

---

### Task 5 — Add-agent header icon restyle ⏳

**Change:** In `add-agent-modal.tsx` line ~262:
- Remove `bg-acc-faint`, `border`, `rounded-[9px]`, `w-[34px] h-[34px]`
  from the wrapper.
- Bump `<Icon name="plus" size={16} />` → `size={32}`.

**Acceptance:** Icon 2× bigger, no square background.

---

### Task 6 — Center + emphasize "Load more" ⏳

**Files:** `modules/projects/components/project-activity.tsx`

**Change:** Wrap the Load-more button in a `flex justify-center` row;
switch button variant from ghost → primary-outline (accent border, accent
text, subtle bg).

---

### Task 7 — Agents page click spawns new instance ⏳

**Change in `modules/agents/components/agent-list.tsx`:**
- Replace `onOpen={() => select(a.name)}` with a handler that:
  - Checks `useActiveProjectStore.id`. If null → show a small inline toast
    "Pick a project first" (or open the project switcher).
  - Otherwise, calls `useSpawnInstance().spawnInstance(a.name)` to add a
    fresh instance, then `select(a.name, { instanceId, tab: "conversation" })`.
- Sidebar/office-canvas paths still call `select()` directly — untouched.

**Acceptance:** Clicking an agent card from the Agents page adds a new
roster instance to the active project AND opens its conversation.

---

### Task 8 — Instance-cap modal ⏳

**Change in `modules/office/hooks/use-spawn-instance.ts`:**
- Replace `window.confirm(t("sidebar.instance_cap_soft"))` and
  `window.alert(t("sidebar.instance_cap_hard"))` with a controlled modal
  state that pops a new `<AgentCapModal>` component.
- Soft cap modal: 2 CTAs — "Ignore & continue" (forces via `force: true`)
  and "Cancel".
- Hard cap modal: 1 CTA — "OK". No override.
- Modal design matches app's dark theme + existing modal shell.

**Files:**
- new `modules/office/components/agent-cap-modal.tsx`
- `modules/office/hooks/use-spawn-instance.ts` (return modal state)

---

### Task 9 — Skills manager page + repo tracker ⏳

The biggest single task. Do carefully.

**New surfaces:**

1. **Sidebar entry** — add "Skills" nav item (icon: `sparkle` or `book`).
   Route: `/skills`.

2. **`/skills` page** (`app/(app)/skills/page.tsx` → renders
   `modules/skills/components/skills-page.tsx`):
   - Header: "Skills" + "Add source" button + total count.
   - Filter chips (category / installed / has-update).
   - Grid or list of installed skills. Each row:
     - Slug, category chip, description, token cost pill (from existing
       manifest hooks).
     - Actions: view md, edit md, uninstall, view source repo.
   - "Sources" panel (collapsible): list of tracked GitHub repos with
     "Last checked", "N skills", update-check button.

3. **"Add source" modal**:
   - Tab 1: Paste a GitHub URL (`https://github.com/user/repo`, optionally
     with `#branch`).
   - Tab 2: Drop a `.md` file from your local machine.
   - When URL entered:
     - Clone / fetch the repo shallowly to a temp dir.
     - Scan for `.md` files following the rule in
       Q8's resolution.
     - Show a preview list of found files with checkboxes (default: all on).
     - "Install selected" → copies chosen files to
       `~/.claude/skills/<repo-slug>/<slug>.md` and registers the repo
       in a tracked-sources file at `~/.claude/agent-office/skill-sources.json`.

4. **Update-check flow**:
   - On app boot (server side, in `instrumentation-node.ts` or a cron in
     the domain layer), poll each tracked repo for new commits (git
     ls-remote).
   - If any tracked repo's HEAD differs from stored SHA, mark
     "N updates available".
   - New titlebar UI element next to "Dev" button: bell icon with a red
     badge showing count. Clicking opens a dropdown listing updates with
     per-item "Update" buttons + a global "Update all".

**Files:**
- new `app/(app)/skills/page.tsx`
- new `modules/skills/components/skills-page.tsx` (replaces the current
  minimal one)
- new `modules/skills/components/add-source-modal.tsx`
- new `modules/skills/components/skill-updates-dropdown.tsx`
- new `components/layout/updates-bell.tsx` (in titlebar)
- `packages/domain/src/services/skills.ts` (extend with git-tracking:
  `listSources()`, `addSource()`, `checkForUpdates()`, `updateSource()`)
- new API routes: `/api/skills/sources` (POST/DELETE/GET) — already
  exists but needs extension. `/api/skills/check-updates` (POST).

**Constraints:**
- Never delete anything the user manually edited — track a hash of the
  originally installed content; if user modified locally, prompt on
  update.
- Only `.md` files are copied. All other file types ignored.
- No shell escapes — build git commands with `execFile`, arrays, never
  string interpolation.

---

### Task 10 — Memory page: skill preview + virtualization + audit ⏳

**Changes:**

1. **Audit** — count how many agents have `~/.claude/agents/<id>.md` but
   no `~/.claude/agents/<id>.memory.md`. If most don't have memory, spawn
   `agent-architect` (once) to propose default memory content per agent
   and populate the missing files. Report to user for approval before
   bulk-writing.
2. **Memory nav**: when an agent is selected, show a nested list of that
   agent's `skills` frontmatter items below the agent row. Click a skill
   → the right pane switches from memory editor to a read-only markdown
   preview of that skill's `.md` file (from the manifest cache).
3. **Virtualization**: use `react-window` for long docs. When the file is
   > 800 lines, render as a virtualized markdown block; otherwise render
   inline as today.
4. Fix warnings in memory-nav (77-line function) while there.

**Files:**
- `modules/memory/components/memory-nav.tsx`
- new `modules/memory/components/skill-preview.tsx`
- new `modules/memory/components/virtualized-markdown.tsx`
- new hook `modules/memory/hooks/use-agent-skills-preview.ts`

**Package:**
- `pnpm add react-window @types/react-window` in `apps/web`

---

### Task 11 — Limits → Analytics ⏳

**Changes:**

1. Rename sidebar entry "Limits" → "Analytics".
2. Rename `ClaudeLimitsModal` → `AnalyticsPanel`, convert modal into a
   full-screen page at `/analytics` (or keep modal — user pick, default
   modal). Given user said "modal is fine", KEEP the modal for now.
3. Delete `parseLimits()` / quota-block from `/api/summon/route.ts` +
   `/api/broadcast/route.ts` (they'll return 402 forever otherwise) — the
   user said we don't use limits. Move `getSumCostSince()` etc. to the
   analytics view instead.
4. Delete `claude-limits-store` + `claude-limits.ts`. Keep any shared
   period helpers by extracting them into
   `modules/analytics/format/period.ts`.
5. Install `chartist` + `@types/chartist`. Wrap in a tiny React adapter
   (`components/ui/chart.tsx`) since chartist is vanilla.
6. Charts to show (in the modal):
   - Total runs (card)
   - Total tokens (card, in/out split)
   - Total cost (card, $ formatted)
   - Runs over time (bar, last 30d)
   - Cost over time (line, last 30d)
   - Tokens by model (donut)
   - Top 10 agents by runs (horizontal bar)
   - Hourly heatmap (reuse existing)
7. Fix warnings in the file (555-line ClaudeLimitsModal function → split
   into ChartCard, StatsRow, HourlyHeatmap sections).

**Files:**
- `modules/limits/**` → renamed to `modules/analytics/**`
- new `components/ui/chart.tsx`
- delete `lib/claude-limits*.ts`
- edit `/api/summon/route.ts`, `/api/broadcast/route.ts` (drop quota
  block)
- edit `apps/web/src/components/layout/sidebar.tsx` (rename)

---

### Task 12 — QueryState primitive + skeleton audit ⏳

**Deliverables:**

1. New primitive `components/ui/query-state.tsx`:
   ```tsx
   <QueryState result={q}
     loading={<Skeleton …/>}
     error={(e) => <ErrorCard …/>}
     empty={<EmptyState …/>}
   >
     {(data) => <Body data={data}/>}
   </QueryState>
   ```
   Uses `ts-pattern` internally over `{ isPending, isError, data }`.
   `empty` renders when `data` is `[]` / `null` / matches a predicate the
   caller supplies.

2. Audit sweep (roll out to Office / Project detail / Agents / Memory /
   Settings first, then the rest):
   - Every fetching page → wrap with `<QueryState>`.
   - Skeletons only for DYNAMIC parts (not for static headings).
   - Empty states must have a clear CTA.

**Files:**
- new `components/ui/query-state.tsx`
- edits across ~20 pages

---

### Task 13 — Workflows (rebrand + 3 curated) ⏳

**Changes:**

1. Rename module: `modules/prompts` → `modules/workflows`.
2. Rename API route: `/api/prompts` → `/api/workflows`.
3. Rename dialog: `prompt-picker-dialog` → `workflow-picker-dialog`.
4. Delete all existing saved-prompt content.
5. Seed 3 curated workflow prompts, each stored as a `.md` file in
   `~/.claude/agent-office/workflows/`:
   - `refactor-codebase.md` — Refactor code base checklist.
   - `security-vulnerability-scan.md` — Scan for security issues.
   - `html-to-app-conversion.md` — Convert provided HTML design.
   Each authored carefully; run `cs-content-creator` or
   `senior-prompt-engineer` agent for polish before committing.
6. Sidebar Composer's slash-menu updated so `/workflow` opens the picker.

**Files:**
- rename module + api route
- new 3 md files under `~/.claude/agent-office/workflows/`
- update i18n strings

---

### Task 14 — Memory page: Docs tab ⏳

**Convention** (locked in):
Agent-authored context docs live at:
`~/.claude/agent-office/docs/<agent-id>/<slug>.md`

Each doc has YAML frontmatter:
```yaml
---
title: "Plan for ..."
category: architecture | plan | notes | postmortem | context | reference
created: 2026-07-13T14:22:00Z
updated: 2026-07-13T15:00:00Z
---
```

Also colocate top-level docs at `~/.claude/agent-office/docs/_global/` for
non-agent-specific notes.

**Changes:**

1. New service `packages/domain/src/services/docs.ts`:
   `listDocs()`, `readDoc()`, `writeDoc()`, `deleteDoc()`.
2. New API routes `/api/docs/`.
3. Memory-page top-level tabs (added above the current global/project/agent
   nav): `Memory` | `Docs`.
4. Docs tab: left nav categorized (Architecture / Plans / Notes /
   Postmortems / Context / Reference) with agent-id sub-groups. Right
   pane: markdown editor with save/delete.
5. Agent-authored writes go through the new API. Add a `writeDoc()`
   helper in the agent CLI toolkit (a small script that agents can
   invoke).

**Files:**
- new `packages/domain/src/services/docs.ts`
- new `app/api/docs/route.ts`
- edit `app/(app)/memory/page.tsx`
- new `modules/memory/components/docs-tab.tsx`

---

### Task 15 — Surgical cleanup in Performance tab ⏳

Add a "Cleanup" panel to `settings/performance-tab.tsx` with each of:

- Reset chat transcripts (all / per-project / per-agent)
- Clear composer drafts
- Wipe orphaned recovered runs
- Reset agent memory files (per-agent, `~/.claude/agents/<id>.memory.md`)
- Reset User Analysis file
- Clear skill install cache (`~/.claude/skills/`)
- Reset app UI settings (theme etc.)
- ⚠ Everything (bulk nuke of the above)

Each has its own confirm modal. **Analytics data (runs history, cost,
tokens) is preserved** across all buttons EXCEPT "Everything".

Backend: extend `packages/domain/src/services/db.ts` with per-category
delete queries; expose via `/api/cleanup/<kind>` (POST).

---

### Task 16 — About You overhaul ⏳

**Changes:**

1. Rewrite `~/.claude/agents/user-analyst.md` prompt:
   - Categorize output into strict markdown H2 sections:
     - Good
     - Bad
     - Interesting
     - Facts
     - Conversational Skills
     - What can be improved
     - Red flags
     - Juicy stuff
   - Every insight is one bullet, no meta-commentary, no "based on the
     data" wording.
   - Ask `agent-architect` and `cs-content-creator` for prompt-writing
     help — use both to produce a polished, mature prompt.
2. Frontend `AboutYouTab`:
   - Replace the current plain-text render with the existing
     `<MarkdownPreview>` component (from `settings-tab/markdown-preview.tsx`).
   - Render each H2 as a card with its own accent color.
3. Regenerate button should spawn `user-analyst` as a normal chat run
   (visible in the run stream, cost tracked).

---

### Task 17 — Final QA ⏳

- Open `workflows/refactor-codebase.md` (created in task 13) as a run
  against the entire tree via the Composer.
- Feed it the run stream + code diffs it identifies.
- Fix critical items it flags, defer the rest as follow-ups.
- Monitor its output for hallucinations and format issues; if the
  workflow itself is weak, iterate on the prompt.
- Do NOT auto-apply changes it suggests — user-review each.

---

## Session log (append as we go)

- 2026-07-13T?? — Plan written. Starting Phase A now.
