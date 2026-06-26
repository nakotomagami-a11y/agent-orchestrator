# Agent Office

> Your Claude Code agents, visualized as a living isometric office. Summon, orchestrate, broadcast, and watch them work in real time.

Personal multi-agent IDE for developers running 3+ Claude Code subagents on real projects. Pick a project, scope a roster, drop a prompt, see streamed output - all inside a GNOME-styled desktop shell with a pixel-art office floor.

## Features

### Orchestration
- **Summon** any agent against any project with live SSE-streamed output and full transcript history
- **Multi-instance agents** - run the same agent 3x in parallel on different scopes (each gets its own transcript, draft, and run history)
- **Pipelines** - multi-step orchestrator dispatch: one agent plans, dispatched subagents execute, results streamed back
- **Broadcast** - blast the same prompt to N agents at once
- **Saved prompts library** - curated, reusable prompts surfaced from your real history (not generic dev-101 templates)
- **Abort all** - kill every running agent with one click

### The office
- **Isometric pixel-art floor** rendered with Pixi.js - drag agents from the sidebar onto grass tiles, decorate with plants/desks/whiteboards, persist the whole scene to SQLite
- **Live status overlays** - colored status dots on each cubicle (idle / running / error)
- **Ghost cards** during drag, smooth pan/zoom, scroll-to-cursor zoom
- **Build mode** - paint terrain, place decorations, repaint grass colors, full edit/erase

### Knowledge & memory
- **Per-agent memory editor** - edit `~/.claude/agents/<id>.md` definitions inline
- **Global memory editor** - manage the machine-wide `CLAUDE.md`
- **Skills registry** - browse, install, and auto-update Claude Skills from configured sources
- **Docs viewer** - in-app browser for exported run docs

### Discovery & history
- **Global search** across every run, message, and transcript
- **Activity feed** - chronological view of every summon
- **Spend tracking** - cost-per-agent, cost-per-project, daily totals
- **Run detail pages** - full transcript with cost, tokens, model, duration
- **Command palette** (Cmd/Ctrl+K) - jump to any agent, project, run, or page

### Integrations
- **Git worktrees** - each project's worktree tree is tracked and surfaced
- **Branch detection** - active branch shown next to project
- **Dev-server tracking** - long-running dev servers managed and visible in the Processes modal
- **Clipboard image paste** - paste screenshots straight into the composer
- **Claude usage limits** - live read of your account's session / 5-hour / weekly limits
- **Sleep inhibitor** - keeps the machine awake while runs are streaming

### Reliability
- **Crash recovery** - orphan runs left over from a crash are auto-marked on next boot; interrupted pipelines surface a recovery banner
- **Atomic file writes** for every persisted markdown asset
- **WAL-mode SQLite** with foreign keys on
- **Export/import** the full app state for backup or migration

### Platform
- **Browser** at `localhost:3001` for daily use
- **Tauri desktop bundle** with custom GNOME-style titlebar for a native feel
- **Mobile bottom nav** - the office is responsive enough to triage from a phone
- **i18n** via next-intl (English shipped, structure for more)

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + custom design system (Ubuntu Yaru / GNOME aesthetic - Yaru orange `#E95420` + aubergine)
- **Pixi.js v8** for the isometric office canvas
- **Zustand** for client stores, **TanStack Query** + **axios** for server state (API calls live in `src/lib/api/` modules — see [`apps/web/docs/data-fetching.md`](apps/web/docs/data-fetching.md))
- **better-sqlite3** at `~/.claude/agent-office/db.sqlite` - runs, messages, transcripts, drafts, pipelines, saved prompts, UI state
- **framer-motion** for page + modal transitions
- **ts-pattern** + **zod** for typed control flow and validation
- **Tauri v2** for desktop bundling
- Backend runs in-process inside Next.js; shells out to `claude -p` per summon and streams stdout back over SSE

## Monorepo

```
apps/
  web/        Next.js app (UI + API routes + SSE runner)
  landing/    Static marketing site
packages/
  shared/     Types, DB layer, services (runs, agents, pipelines, skills, worktrees, ...)
  ui/         Shared design-system primitives
```

Inside `apps/web/src`:

- `app/(app)/` - pages: office, activity, projects, agents, runs, search, memory, skills, docs, settings, spend
- `app/api/` - REST + SSE endpoints: summon, runs, agents, processes, pipeline, broadcast, saved-prompts, skills, memory, transcripts, drafts, ui-settings, save (export/import), templates, account, health
- `components/layout/` - GNOME window chrome, titlebar, sidebar, project switcher, mobile nav
- `components/ui/` - design-system atoms (Icon, StatusDot, Button, Modal, Tabs, ...)
- `components/command-palette/` - Cmd+K palette
- `modules/office/` - isometric scene, Pixi canvas, build toolbar, map overlay
- `modules/summon/` - chat panel, transcript thread, composer, live status
- `modules/prompts/` - saved-prompts picker dialog
- `modules/processes/`, `modules/limits/`, `modules/memory/`, `modules/skills/`, `modules/projects/`, `modules/agents/`, `modules/runs/`, `modules/search/`, `modules/settings/`, `modules/onboarding/`
- `lib/` - Zustand stores (theme, active-project, claude-limits, processes, dev-server, branch, palette, flutter), the axios `api-client`, and `api/` resource modules

## Run it

Requires **Node 22+** and **pnpm**.

```sh
pnpm install
pnpm dev              # → http://localhost:3001
pnpm dev:landing      # → marketing site

pnpm build            # next build of apps/web
pnpm start            # production server
pnpm typecheck        # tsc --noEmit across the workspace
pnpm lint
```

Desktop bundle:

```sh
pnpm --filter @agent-office/web tauri:dev
pnpm --filter @agent-office/web tauri:build
```

## Architecture notes

- **Agent definitions** are markdown files in `~/.claude/agents/`. The app scans that directory to build the roster and lets you edit definitions inline.
- **Summon** shells out to `claude -p "<prompt>"` per run; stdout streams back over SSE to the chat panel and persists to SQLite as it arrives.
- **Pipelines** are stored as a parent `pipelines` row plus N `pipeline_steps` children; each step is its own `claude -p` invocation, dispatched by the orchestrator agent and tracked independently.
- **Saved prompts** live in their own SQLite table; the picker dialog is one keystroke away in the composer and supports tags + scopes.
- **Skills** are installable bundles from configured registries; updates are checked against source manifests and surfaced in the Skills page.
- **Sleep inhibitor** acquires a `systemd-inhibit` lock for the duration of any active run so the laptop doesn't sleep mid-task.
- **Crash recovery**: on DB open, any run still marked `running` is flipped to `error` with `exit_code=-1`; any pipeline still `running` is marked `interrupted=1`.

## Status

Personal project, MIT spirit but no license declared. Not production-grade for shared use - assumes a single local user with `claude` on `$PATH` and a populated `~/.claude/agents/` directory.
