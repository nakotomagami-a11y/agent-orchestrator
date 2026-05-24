# Docs Completeness Initiative

**Date:** 2026-05-24
**Status:** LOCKED — orchestrator dispatching
**Owner agent:** `orchestrator`
**Goal:** Make `apps/web/src/app/(app)/docs/page.tsx` the canonical, deep, accurate reference for the app. **Remove `apps/landing/src/app/docs/` entirely** — landing site links instead point to the in-app docs (or are removed). Publish an agent-readable skill `agent-office-internals` that is **opt-in only** (not auto-installed).

---

---

## Locked decisions (2026-05-24, human-confirmed)

| # | Decision | Value |
|---|----------|-------|
| 1 | Scope | **In-app docs only. Landing `/docs` page is deleted entirely (not reduced).** |
| 2 | Audit memo | Phase 1 `explore` agent writes `docs/decisions/2026-05-docs-audit.md` alongside the source map. |
| 3 | Rollout | **Replace in place. No `features.docsV2` flag.** |
| 4 | `agent-office-internals` skill | **Opt-in only.** Bundled in starter offerings; default unchecked. Never auto-installed. |

These supersede any "recommended" wording elsewhere in this file. Phase 9 below has been rewritten accordingly.

## Audience & success criteria

Three readers must come away able to answer their questions without leaving the page:

1. **New developer** — "How do I add a new agent / write a skill / wire a new tool?" Answerable in <5 minutes.
2. **QA / testing agent** — "What API endpoint do I hit to spawn a run? What SSE events stream back? What columns does `runs` have?" Answerable from a single Reference tab.
3. **Agent itself** (via the new skill below) — "What memory tiers exist? Where is the SQLite db? How do I query my own past runs?" Answerable from injected system prompt.

**Done when:** every claim cites the source file in an HTML comment (`<!-- src: packages/shared/src/services/runs.ts#L185 -->`), Tier 1–4 gaps from the audit memo are closed, landing docs are ≤250 lines and link into the app for depth, and the `agent-office-internals` skill exists at `~/.claude/agents/_skills/agent-office-internals/SKILL.md`.

---

## Source-of-truth rule

**Every assertion must cite the file it came from.** Use HTML comments inline in the TSX:

```tsx
<P>
  When you summon an agent, Agent Office spawns the Claude Code CLI as a
  subprocess and parses stdout as NDJSON.
  {/* src: packages/shared/src/services/runs.ts#L183-L190 */}
</P>
```

Reviewers should be able to `grep` the comments and verify every line. This is the only protection against doc rot.

---

## Phase 0 — Lock the audit (Human, 15 min)

Before any agent runs, the human must commit the audit findings:

- [ ] Confirm scope is "in-app docs canonical + landing reduced + agent skill". Not "build a hosted docs site".
- [ ] Confirm `docs/decisions/2026-05-docs-audit.md` will be written by the orchestrator at Phase 1 start (so this plan and the audit live in the same place).
- [ ] Decide: ship behind a `features.docsV2` flag, or replace in place? **Recommendation: replace in place.** Docs aren't user-state-touching code; a flag adds maintenance burden with no upside.

**Gate:** Decisions written into this file as a "Locked" addendum.

---

## Phase 1 — Source map (parallel research)

**Sub-agent:** `explore`
**Duration:** 1–2 hours
**Output:** `docs/decisions/2026-05-docs-source-map.md` — a machine-readable inventory the writing phases will consume.

### Task prompt for `explore` (paste verbatim into Task tool)

```
You are building a source map for the docs rewrite. Produce a single
markdown file at docs/decisions/2026-05-docs-source-map.md with these
sections, each grounded in actual code reads (cite file:line for every
entry):

## 1. REST API surface
For every file matching apps/web/src/app/api/**/route.ts:
- Method(s) exported
- Path (with route params)
- Request body shape (cite the validation schema if any)
- Response shape (success and error cases)
- One-line description of what it does

## 2. SSE event types
Find every SSE event type emitted. Search for:
- res.write(`event: ...`) patterns
- broadcast.* calls
- Any "data: ..." pattern in NDJSON writers
For each event: name, payload shape, where emitted, who subscribes.

## 3. SQLite schema
Read packages/shared/src/services/db.ts.
For every CREATE TABLE / CREATE INDEX:
- Table name
- Columns with types
- Indexes
- Migration order
Note WAL mode setup, busy timeout, any custom pragmas.

## 4. Claude CLI flag set
Read packages/shared/src/services/summon.ts (buildClaudeArgs) and runs.ts.
Document the exact argv list Agent Office builds, in order, with what
sources each flag value comes from.

## 5. Environment variables
grep across the repo for process.env.* and document each:
- Variable name
- Required vs optional
- Default value
- What it controls

## 6. File-system layout
Walk packages/shared/src/services/paths.ts and any service that writes
to disk. Produce the definitive list of every file/dir Agent Office
reads or writes, with absolute paths (using ~ for home).

## 7. Tool reference
List every tool name accepted via the `tools:` frontmatter field. Cross
reference packages/shared/src/config/agent-opts.ts and any allowlist
in summon.ts. Note tools provided by MCP servers (Playwright,
chrome-devtools per the user's CLAUDE.md).

## 8. Features inventory
For each module under apps/web/src/modules/ and each API folder under
apps/web/src/app/api/, write one line: feature name, what it does,
whether currently documented (Y/N) per the audit memo.

Output formatting:
- Use H2 for each numbered section above
- Use tables wherever possible (file refs in monospace)
- Cite file:line for every claim
- Do NOT include opinion or recommendation
- Do NOT rewrite docs in this phase

When done, return: "Source map complete at <path>. Counts: X endpoints,
Y events, Z tables, W env vars, V tools."
```

**Acceptance:** File exists, has all 8 sections, every claim has a `file:line` reference. Counts are reported back to the orchestrator.

---

## Phase 2 — Restructure the docs skeleton

**Sub-agent:** `frontend-craftsman`
**Duration:** 0.5 day
**File:** `apps/web/src/app/(app)/docs/page.tsx`

### Task prompt

```
Restructure the docs tab skeleton in apps/web/src/app/(app)/docs/page.tsx
without yet writing new content. Goal: make room for the new Reference
material and adopt a per-tab section anchor pattern so deep-links work.

Changes:

1. Replace the 5 tabs with 6:
   - getting-started
   - agents
   - projects        (renamed from "Projects & Memory" — memory becomes its own tab)
   - memory          (NEW tab)
   - usage
   - reference       (expanded — see below)

2. Inside the "reference" tab, add five Card components as placeholders
   with eyebrow + title + a single <P>TODO</P> child:
   - storage         (existing — keep content)
   - architecture    (existing — keep content)
   - api             (NEW — REST API reference)
   - events          (NEW — SSE event reference)
   - schema          (NEW — SQLite schema reference)
   - build           (NEW — CLI flags + env vars + build-from-source)

3. Add a per-tab right rail (sticky) showing in-page anchor links to
   each Card on the active tab. Use the existing useRef-on-scroll
   container; add a 200px right rail visible at >= md breakpoint.

4. Pull version from process.env.NEXT_PUBLIC_APP_VERSION (set this in
   next.config from package.json version). Replace the hard-coded
   "v0.1" string.

5. Keep all existing content — do not delete anything. Just move it
   into the right tab and add the new empty Cards.

6. Add the source-citation HTML comment pattern: after each existing
   Card that makes claims about code behaviour, add a TODO comment:
   {/* TODO: add src refs once Phase 3 lands */}

Do NOT add new prose in this phase. The goal is a clean skeleton ready
for content to be poured in.
```

**Acceptance:**
- 6 tabs render.
- New empty Cards in Reference tab.
- Right rail shows anchors on each tab.
- Version string pulled from build-time env.
- No existing content lost.

---

## Phase 3 — Tier 1 content (user-blocking gaps)

**Sub-agent:** `frontend-craftsman`
**Duration:** 1 day
**Inputs:** source-map from Phase 1; audit memo from Phase 0.

### Task prompt

```
Read docs/decisions/2026-05-docs-source-map.md and the audit findings.
Write content for the following Tier-1 gaps directly into
apps/web/src/app/(app)/docs/page.tsx. One Card per gap. Each Card lives
in the tab listed.

For every Card:
- Use existing primitives (Card, P, Pre, Table, Note, Flow, H3, C).
- Cite source files with HTML comments: {/* src: <path>#L<line> */}
- Keep prose tight. Aim for ~80 words per <P> max.
- No marketing language. This is reference.
- Show real shapes from code, not invented examples.

GAPS TO CLOSE:

### usage tab → "Pipelines" card
Source: packages/shared/src/services/pipeline.ts, /api/pipeline,
/api/pipeline/[id]
Cover:
- Sequential vs parallel step shapes (PipelineStep, ParallelPipelineStep)
- 10-minute step timeout, 30-minute overall cap
- {{output}} substitution between steps
- Recovery on app restart (interrupted: true)
- API contract for POST /api/pipeline (request shape) and GET
  /api/pipeline/[id] (response shape)
- One JSON example of a 3-step request with one parallel group

### usage tab → "Multi-instance & worktrees" card
Source: packages/shared/src/services/worktrees.ts,
docs/decisions/2026-05-multi-instance.md
Cover:
- The git-worktree isolation model
- .worktrees/<instanceId>/ path pattern
- Branch naming agent/<instanceId>-<timestamp>
- Soft cap 5 / hard cap 10 per agent per project
- 409 INSTANCE_CAP_EXCEEDED with softCap boolean
- Non-git fallback (shared cwd, warning toast)
- Lifecycle: spawn → use → terminate cleans worktree → branch left for git log

### usage tab → "Processes panel" card
Source: /api/processes, /api/processes/[pid], /api/processes/[pid]/logs,
apps/web/src/modules/processes/
Cover:
- What this is for (dev servers, docker, etc. spawned from agent runs)
- How to view active processes from the sidebar
- Log tailing endpoint
- Lifecycle (when processes get killed: app close, manual)

### usage tab → "Spend limits & quota" card
Source: apps/web/src/lib/claude-limits.ts, apps/web/src/app/api/summon/route.ts:26-43
Cover:
- Where the quota is configured (Settings → Limits)
- Period options (daily / weekly / monthly)
- hardCap modes: off / warn / block
- 402 quota_exceeded error path
- 80% warn threshold
- Per-run spend cap (separate)

### getting-started tab → "First-run wizard" card
Source: apps/web/src/modules/onboarding/components/first-run-wizard.tsx
Cover:
- What the wizard collects (projects root, starter agents import)
- What gets created on first launch (default settings.json, db.sqlite)
- How to re-run / reset
- What can be changed later in Settings

### reference tab → "Save / Export / Import" card
Source: /api/save/export, /api/save/import
Cover:
- What gets exported (agents, projects, memory — confirm via code)
- Format (zip, json — confirm via code)
- How to restore
- What does NOT get exported (the SQLite db, since it's a separate backup path)
- Cross-machine migration workflow

When done, return: "Tier 1 content shipped. Cards added: <list>. Total
new lines: <n>. Source refs: <count>."
```

**Acceptance:**
- All six Cards exist and render.
- Every factual claim has a `src:` HTML comment.
- No invented JSON / API shapes — all examples derived from real code.
- App still builds (`pnpm --filter web build` succeeds).

---

## Phase 4 — Tier 2 depth (sharpen existing topics)

**Sub-agent:** `frontend-craftsman`
**Duration:** 1 day
**Inputs:** source map.

### Task prompt

```
Read docs/decisions/2026-05-docs-source-map.md. Expand the following
existing Cards in apps/web/src/app/(app)/docs/page.tsx with the
specific depth gaps listed. Append new sections inside each Card —
do not rewrite from scratch. Cite sources.

### agents tab → "Skills" card — ADD:
- H3 "Skill source provenance" — describe .source.json (sha, source,
  installed_at) and what it's used for
- H3 "Registry refresh" — 1hr TTL, manual refresh from UI, file path
- H3 "Name conflicts" — what happens when two skills define the same name
- H3 "Security" — third-party skills run with the agent's full tool
  access. Read before installing.

### agents tab → "How the system prompt is assembled" card — ADD:
- H3 "Size limits" — what's the cap, what happens at the cap
- H3 "Ordering rationale" — why skills first (most stable), memory last
  (most volatile)
- H3 "Per-agent escape hatches" — how to override ordering

### usage tab → "Run history" card — ADD:
- H3 "Schema" — pull from source map, render as Table
- H3 "Retention" — none by default, manual pruning patterns
- H3 "Export individual run" — DB query + jq pipeline example
- H3 "FTS index" — if exists, document the runs_fts virtual table

### usage tab → "Office floor" card — ADD:
- H3 "Layout persistence" — per-project, stored where, schema
- H3 "Build mode constraints" — what can't you do (grid bounds, etc.)
- H3 "Removing an agent with a placed desk" — what happens to the tile

### memory tab → existing memory content — ADD:
- H3 "256KB soft limit" — what's enforced, why, what happens above it
- H3 "Self-modification race conditions" — when agent writes to its own
  memory mid-run
- H3 "Manual git tracking" — recipe for putting ~/.claude/agents under git

### agents tab → "Frontmatter reference" — ADD/FIX:
- Verify the existing Table against packages/shared/src/types/index.ts
  AgentInfo and packages/shared/src/services/agents.ts parser. Fix
  any drift. Add fields that are real but missing (e.g. addDirs, room).
- Verify the "tools reference" table against the full Claude Code tool
  list — add MCP-provided tools section (Playwright, chrome-devtools).

Return: "Tier 2 depth complete. Cards expanded: <list>. Source drift
fixed: <count>."
```

**Acceptance:**
- Each existing Card has the added H3 subsections.
- Frontmatter table matches actual `AgentInfo` type field-for-field.
- App still builds.

---

## Phase 5 — Tier 4 developer reference (API / SSE / schema / build)

**Sub-agent:** `frontend-craftsman`
**Duration:** 1 day
**Inputs:** source map — this phase exists because of it.

### Task prompt

```
Read docs/decisions/2026-05-docs-source-map.md. Fill the four empty
Reference cards (api, events, schema, build) with content derived
from the source map. Use the existing primitives.

### reference tab → "REST API" card
- One Table per HTTP method group (GET / POST / PATCH / DELETE)
- Columns: Path, Description, Request body, Response
- Group adjacent paths under H3 ("Agents", "Projects", "Runs",
  "Pipelines", "Skills", "Memory", "Processes", "Settings", "Save",
  "Health & Account")
- For request/response shapes, show the TypeScript type name and the
  source file (e.g. "SummonRequest — src: packages/shared/src/types
  /index.ts#L148")
- Do NOT inline full JSON shapes — link the type. Keep the page scannable.

### reference tab → "SSE events" card
- One Table: Event name | Payload type | Emitter | Subscriber
- One Pre block per event with the literal `event: <name>\ndata: <json>`
  format
- Note the "late joiner replay" behaviour from the in-memory event log
- Note connection cleanup on tab close

### reference tab → "Database schema" card
- One H3 per table
- Under each H3: a Pre block with the CREATE TABLE statement, a Table
  describing each column purpose, and a list of indexes
- H3 "Pragmas" — WAL mode, busy timeout, journal_size_limit if set
- H3 "Migrations" — how migrations work, where they live, idempotency
- H3 "Direct query examples" — sqlite3 CLI recipes for the 5 most
  common queries QA might run

### reference tab → "Build & run" card
- H3 "Stack" — keep existing Table
- H3 "Run lifecycle" — keep existing diagram, add sequence number for
  each SSE event
- H3 "Claude CLI flags" — Table from source map showing every flag
  Agent Office builds, with the source of each value
- H3 "Environment variables" — Table from source map (var, default,
  effect)
- H3 "PATH augmentation" — expand existing paragraph with the
  precedence order shown as a numbered list
- H3 "Dev mode" — `pnpm dev`, ports used (3000/3001/3002), how to run
  Tauri shell separately
- H3 "Building a release" — pnpm + tauri commands, output paths,
  signing notes (or "TODO: signing")

Return: "Developer reference complete. Cards filled: <list>. Endpoints
documented: <n>. Events: <n>. Tables: <n>. Env vars: <n>."
```

**Acceptance:**
- All four empty Cards now have content.
- Endpoint count in the docs matches endpoint count in the source map (±1 for legitimate edge cases).
- Schema count matches.

---

## Phase 6 — Tier 3 minor features appendix

**Sub-agent:** `frontend-craftsman`
**Duration:** 0.5 day

### Task prompt

```
Append one final Card to the "reference" tab titled "Other features".
Under it, list every Tier 3 minor feature from the audit memo as a
small subsection (H3 + one paragraph + one Pre block if relevant):

- Agent body history (/api/agents/[id]/body/history)
- Agent prompts library (/api/agents/[id]/prompts, /api/prompts)
- Drafts (/api/drafts)
- Uploads (/api/agents/[id]/uploads/[filename])
- Clipboard image paste (/api/clipboard-image)
- Templates (/api/templates)
- Starter agents (/api/starter/agents)
- Bulk agent operations (/api/agents/bulk)
- Broadcast / cross-tab events (/api/broadcast)
- UI settings (/api/ui-settings)
- Health endpoint (/api/health)
- Transcripts (/api/transcripts)
- Account (/api/account)
- Command palette (Cmd+K)

Each subsection: 50-100 words, one source ref. If a feature is
experimental or deprecated, prefix with a <Note kind="warn"> saying so.

Return: "Tier 3 appendix complete. Features documented: <count>."
```

**Acceptance:** Every Tier-3 feature has a subsection. Experimental ones are flagged.

---

## Phase 7 — Inaccuracy sweep + verification

**Sub-agent:** `qa-codebase`
**Duration:** 0.5 day

### Task prompt

```
Read apps/web/src/app/(app)/docs/page.tsx end-to-end.

For every HTML comment matching `{/* src: ... */}`:
1. Open the cited file and verify the line still says what the docs claim.
2. If a line has shifted but the assertion is still true, update the
   line number.
3. If the assertion no longer matches code, FLAG it in a report.

For every Table, Pre block, and Flow that does NOT have a src comment:
- Flag as "uncited claim" — these need source refs added.

Additionally, verify the following known suspect points from the audit:
- Skills ordering: "appended" vs "prepended" — read services/agents.ts
  buildAppendedPrompt and confirm which.
- SQL column names: agent_id vs agentId, started_at vs startedAt —
  confirm against db.ts schema.
- Frontmatter `unit: blue/warrior` example — confirm format from
  apps/web/src/components/ui/agent-avatar.tsx.
- `permission-mode: plan` → "history note omitted" — confirm in
  buildAppendedPrompt logic.
- Version string — confirm now reads from build-time env.

Output: write findings to docs/decisions/2026-05-docs-qa-pass.md
with three sections:
- Confirmed accurate (count only)
- Auto-fixed (file:line shifted but logic same — list each)
- BROKEN (assertions that don't match code — list each with current
  doc claim and actual code)

Do NOT modify the docs in this phase. Just report.

Return: "QA pass complete. Confirmed: X. Auto-fixed: Y. Broken: Z.
Report at <path>."
```

**Acceptance:** Report file exists. Broken count is reported back.

---

## Phase 8 — Fix verification findings

**Sub-agent:** `frontend-craftsman`
**Duration:** 0.5 day (or longer if Phase 7 found many broken claims)

### Task prompt

```
Read docs/decisions/2026-05-docs-qa-pass.md. For every assertion in
the BROKEN section:
1. Open the cited code.
2. Determine the correct claim.
3. Update the docs to match reality.
4. Verify the src comment line number.

For uncited claims flagged in the QA report, add appropriate src
comments by tracing the assertion back to its source.

If any claim is genuinely undecidable (the code is ambiguous or the
docs and code disagree but the user's intent is unclear), surface it
to the orchestrator as a question for the human.

Return: "Verification fixes complete. Fixed: X. Surfaced to human: Y."
```

**Acceptance:** No remaining BROKEN claims. Uncited count → 0.

---

## Phase 9 — Landing docs REMOVAL

**Sub-agent:** `frontend-craftsman`
**Duration:** 0.25 day
**Files:** `apps/landing/src/app/docs/page.tsx`, `apps/landing/src/app/page.tsx`, `apps/landing/next.config.mjs`

### Task prompt

```
The landing-site docs page is being removed entirely. The in-app docs
under apps/web are the only docs surface.

Do this:

1. Delete the entire directory apps/landing/src/app/docs/
   (page.tsx and any siblings). Verify nothing else in the landing
   app imports from there.

2. In apps/landing/src/app/page.tsx, find every `<a href="/docs">...`
   occurrence (the nav link and the footer link were confirmed by
   the human). Two acceptable replacements depending on context:
   - Nav link: REMOVE it. Don't replace with a dead link.
   - Footer "Documentation" link: REPLACE with a link to the GitHub
     repo README or remove it. The landing footer should not advertise
     docs the landing site no longer hosts.

3. In apps/landing/next.config.mjs, add a 308 permanent redirect from
   `/docs` and `/docs/:slug*` to the app's marketing CTA or homepage
   anchor for "How it works":

       async redirects() {
         return [
           { source: '/docs',           destination: '/#how', permanent: true },
           { source: '/docs/:slug*',    destination: '/#how', permanent: true },
         ];
       }

   This protects any external links / SEO that already exist.

4. Build the landing app (`pnpm --filter landing build`) and verify
   no broken imports, no dead routes, no console errors on the home
   page.

5. Search the rest of the repo for any other references to
   `apps/landing/src/app/docs` and confirm only the deleted dir is
   referenced. Report back any orphans found.

Return: "Landing docs removed. Files deleted: <list>. Links updated:
<list>. Redirects added: yes. Build: pass/fail."
```

**Acceptance:**
- Directory `apps/landing/src/app/docs/` no longer exists.
- No `<a href="/docs">` in the landing site source.
- 308 redirects in place for `/docs` and `/docs/*`.
- Landing app builds without errors.


## Phase 10 — Agent-readable skill + export endpoint

**Sub-agent:** `backend-builder`
**Duration:** 1 day

### Task prompt

```
Goal: make the docs machine-readable so agents can consume key
reference data.

### Part A — /api/docs/export endpoint
Create apps/web/src/app/api/docs/export/route.ts that returns a
JSON document with:
- version (from package.json)
- generated_at (ISO timestamp)
- api: list of every endpoint from source map (path, method,
  description, request_type, response_type)
- events: list of every SSE event (name, payload_type, description)
- schema: list of every table (name, columns, indexes)
- env_vars: list of every env var (name, default, effect)
- tools: list of every tool name (name, description, mcp_source?)
- paths: list of every file Agent Office reads/writes (key, path,
  description)

The data should be sourced from a single source-of-truth module —
create packages/shared/src/services/docs-export.ts that imports and
exposes the same data structures, so the in-app docs page and the
API both render from the same source.

Add tests: vitest in apps/web that GET /api/docs/export and verifies
shape.

### Part B — agent-office-internals skill
Write a skill at ~/.claude/agents/_skills/agent-office-internals/SKILL.md
with frontmatter:
- name: agent-office-internals
- description: Internal knowledge of Agent Office runtime — paths,
  tools, schema, memory tiers, and self-introspection patterns.

Body content (markdown):
- "About this skill" — one paragraph explaining it gives agents
  awareness of the runtime they're hosted in.
- "Memory tiers" — three paths with semantics.
- "Self-querying your past runs" — SQLite path, table name, 3 example
  queries an agent might run via Bash.
- "Tool reference" — the 8 most common tools and what they do here.
- "API endpoints you can call" — for agents with WebFetch, the list
  of localhost:3000 endpoints they can hit (read-only ones only).
- "Paths you can read or modify" — memory files, project files,
  agents dir — with safety notes.

Then add a registry source.json:
- source: "agent-office/internal"
- version: matches app version
- sha: "internal"
- installed_at: ISO timestamp

### Part C — bundling
Update the starter-agents importer so a fresh first-run installation
of Agent Office offers (but does not auto-enable) this skill to add
to the user's roster.

Return: "Docs export + skill complete. Endpoint at /api/docs/export.
Skill at <path>. Bundled into starter? Y/N."
```

**Acceptance:**
- `curl localhost:3000/api/docs/export | jq` returns the full document.
- The skill file exists and is well-formed.
- A test agent with `skills: [agent-office-internals]` in its frontmatter sees the content in its system prompt on next summon.

---

## Phase 11 — Cross-tab smoke test

**Sub-agent:** `web-qa`
**Duration:** 0.5 day

### Task prompt

```
Drive the Agent Office app at http://localhost:3000 via Playwright.
For each tab (getting-started, agents, projects, memory, usage,
reference):
1. Click the tab.
2. Verify the right rail anchor list matches the H2/Card titles on
   the page.
3. Click every anchor — verify it scrolls to a real section.
4. Verify no console errors or 404s.
5. Take a screenshot at the top of each tab — save to /tmp.

Verify the version string in the header reads a real version (not
"v0.1").

Return: "Docs smoke test complete. Tabs verified: 6. Console errors:
<n>. Screenshots at /tmp/docs-<tab>.png."
```

**Acceptance:** Zero console errors. All anchors scroll correctly. Screenshots saved.

---

## Dispatch sequence

The orchestrator MUST run phases in this order (some can parallelize):

```
Phase 0 (human) — manual
   ↓
Phase 1 (explore) — must complete first; source map blocks 3-6
   ↓
Phase 2 (frontend-craftsman) — skeleton; can start once Phase 1 is queued
   ↓
Phase 3, 4, 5, 6 (frontend-craftsman) — SEQUENTIAL on same file to avoid merge conflicts
   ↓
Phase 7 (qa-codebase) — read-only audit
   ↓
Phase 8 (frontend-craftsman) — fix BROKEN claims surfaced by Phase 7
   ↓
Phase 9 (frontend-craftsman) — landing docs; independent file, can run earlier if backlog allows
   ↓
Phase 10 (backend-builder) — independent; can run in parallel with Phase 9
   ↓
Phase 11 (web-qa) — final gate; runs after Phases 8, 9, 10 land
```

**Total estimated effort:** 6–7 working days dispatched across 5 sub-agents.

**Cost discipline:** Phases 2–6 + 8 all touch the same file. Run them sequentially even if cheaper to parallelize — merge conflicts in a 1500-line TSX file are not worth saving an hour.

---

## Orchestrator constraints

1. **Read this plan once at the start.** Do not re-read it between phases — extract the task prompts into your working notes.
2. **One Task per phase.** Do not split a phase across multiple Task calls. Each sub-agent gets one shot per phase.
3. **Summarise after each phase.** Before dispatching the next, write a 3-line summary to your transcript: what shipped, what was found, what's the next phase.
4. **Surface decisions to the human immediately.** Phase 7 may find a BROKEN claim that's actually a bug in the code, not the docs. If so, ask the human before either rewriting docs or filing a bug.
5. **Hard stop on Phase 11 failure.** If smoke test fails, do not declare done. Loop back to Phase 8 with the failure report.

---

## Risks

- **Source-map drift.** Code changes between Phase 1 and Phase 5 will make Phase 7 light up with broken refs. Mitigation: front-load Phase 1; aim to finish Phases 1–8 in one calendar week.
- **Frontend-craftsman burns through tokens on a 1500-line TSX file.** Mitigation: each Phase 3–6 task should target specific Cards by id, not "open and read everything".
- **Skill content leaks user-specific info.** Mitigation: Phase 10 Part B prompt explicitly says no machine-specific paths, no API keys, no project names. The skill describes the system, not the user.
- **Landing reduction breaks SEO.** Mitigation: keep all current section anchors as redirects to the in-app docs page. (May require landing-side route handler.)
