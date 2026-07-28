# Agent Office

> [!WARNING]
> **🚧 Heavily under active development.** Agent Office is pre-1.0 and changes fast. Expect breaking changes, half-built features, rough edges, and undocumented behaviour. Data formats and the on-disk layout under `~/.claude/` may change without migration. **Back up your data, and don't rely on it for anything critical.**

> Your Claude Code agents, visualized as a living isometric office. Summon, orchestrate, broadcast, and watch them work in real time.

Personal multi-agent IDE for developers running 3+ Claude Code subagents on real projects. Pick a project, scope a roster, drop a prompt, see streamed output - all inside a GNOME-styled desktop shell with a pixel-art office floor.

## Features

### Orchestration
- **Summon** any agent against any project with live SSE-streamed output and full transcript history
- **Workflow spawn tree** - live sub-agent tree with per-node status badges and cost; shown in chat via the WorkflowPill dropdown while an orchestration is running
- **Multi-instance agents** - run the same agent 3x in parallel on different scopes (each gets its own transcript, draft, and run history)
- **Pipelines** - multi-step orchestrator dispatch: one agent plans, dispatched subagents execute, results streamed back
- **Broadcast** - blast the same prompt to N agents at once
- **Workflows library** - a curated set of reusable, multi-step prompts; opened from the composer (Ctrl+P) or saved from any message
- **Abort all** - kill every running agent with one click
- **Rate-limit warning** - dedicated card in the chat thread when a run hits API rate limits

### The office
- **Isometric pixel-art floor** rendered with Pixi.js - drag agents from the sidebar onto grass tiles, decorate the scene, persist to SQLite
- **Animated unit sprites** - 5 factions × 5 unit kinds (Pawn, Warrior, Archer, Monk, Lancer); each agent gets a sprite set by its `unit` frontmatter field
- **Pawn action animations** - working pawns switch sprite sheets based on surroundings: axe near trees, pickaxe on rocks, knife near sheep, hammer otherwise
- **5 grass color themes** - Meadow (yellow), Forest (green), Spring (light), Marsh (olive), Frost (teal); per-scene choice
- **Cards view** - toggle between isometric grid and compact card layout from the office toolbar
- **Build mode** - paint terrain, flood-fill (F), place 60+ decorations, swap grass colour, full undo/redo (Cmd+Z), decoration search
- **Auto-tiling path tiles** - dirt paths connect to cardinal neighbours automatically; drawn via PixiJS Graphics (no PNG dependency)
- **Bridges** - place horizontal/vertical bridge planks on water; end-caps auto-render on adjacent land tiles; agents stand elevated on bridges
- **Voronoi water shader** - animated teal cellular water pattern behind the island
- **Pixel-planet project icons** - each project gets a deterministic procedural WebGL2 planet icon (11 types: gas giant, rocky, terran, ice world, lava, etc.)
- **Smooth pan/zoom** - Ctrl+Scroll zooms to cursor; arrow keys / drag to pan

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
- **Analytics dashboards** - spend/runs/runtime trends, model split, per-agent and per-project rankings, tool usage, activity heatmap; per-account breakdown when multiple Claude accounts are connected
- **Command palette** (Cmd/Ctrl+K) - jump to any page plus quick actions (toggle theme, abort all runs, open the Processes and Flutter panels)

### Integrations
- **Multi-account** - connect several Claude accounts, see per-account usage in Analytics, and switch the account a run bills against
- **GitHub accounts** - register GitHub identities per project for worktree/PR work
- **Git worktrees** - each project's worktree tree is tracked and surfaced; missing worktrees auto-recreated on next summon
- **Branch detection** - active branch shown next to project
- **Dev-server tracking** - long-running dev servers managed and visible in the Processes modal
- **Clipboard image paste** - paste screenshots straight into the composer
- **Claude usage limits** - live read of your account's session / 5-hour / weekly limits
- **Sleep inhibitor** - keeps the machine awake while runs are streaming

### Reliability
- **Crash recovery** - orphan runs left over from a crash are auto-marked on next boot; interrupted pipelines surface a recovery banner
- **Self-healing worktrees** - if an instance's worktree directory goes missing, it is recreated automatically rather than bricking the instance
- **Atomic file writes** for every persisted markdown asset
- **WAL-mode SQLite** with foreign keys on
- **Export/import** the full app state for backup or migration

### Platform
- **Browser** at `localhost:3000` for daily use
- **Tauri desktop bundle** with custom GNOME-style titlebar for a native feel
- **Mobile bottom nav** - the office is responsive enough to triage from a phone
- **i18n** via next-intl (English shipped, structure for more)

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + custom design system (Ubuntu Yaru / GNOME aesthetic - Yaru orange `#E95420` + aubergine)
- **Pixi.js v8** for the isometric office canvas (GPU-accelerated; PixiJS Graphics for procedural path tiles)
- **`@agent-office/pixel-planets`** — in-house WebGL2 procedural planet renderer; one shared GL context for all project icons
- **Zustand** for client stores, **TanStack Query** + **axios** for server state (API calls live in `src/lib/api/` modules — see [`docs/data-fetching.md`](docs/data-fetching.md))
- **better-sqlite3** at `~/.claude/agent-office/db.sqlite` - runs, messages, transcripts, drafts, pipelines, workflows, UI state
- **framer-motion** for page + modal transitions
- **ts-pattern** + **zod** for typed control flow and validation
- **Tauri v2** for desktop bundling
- Backend runs in-process inside Next.js; shells out to `claude -p` per summon and streams stdout back over SSE

## Monorepo

```
apps/
  web/            Next.js app (UI + API routes + SSE runner)
  landing/        Static marketing site
packages/
  domain/         Types, DB layer, services (runs, agents, pipelines, skills, worktrees, accounts, ...) — imported as @agent-office/domain
  ui/             Shared design-system primitives
  pixel-planets/  WebGL2 procedural planet renderer (@agent-office/pixel-planets)
  pixel-icons/    Procedural pixel-art icon set (@agent-office/pixel-icons)
```

Inside `apps/web/src`:

- `app/(app)/` - pages: office (root `/`), activity, analytics, projects, agents, runs, search, memory, skills, docs, settings
- `app/api/` - REST + SSE endpoints: summon, runs, agents, processes, pipeline, broadcast, workflows, skills, memory, transcripts, drafts, ui-settings, save (export/import), templates, projects, settings, analytics, accounts, github-accounts, agent-docs, cleanup, account, health
- `components/layout/` - GNOME window chrome, titlebar, sidebar, project switcher, mobile nav
- `components/ui/` - design-system atoms (Icon, StatusDot, Button, Modal, Tabs, ...)
- `components/command-palette/` - Cmd+K palette
- `modules/office/` - isometric scene, Pixi canvas, build toolbar, map overlay
- `modules/summon/` - chat panel, transcript thread, composer, workflow picker, live status
- `modules/workflows/` - workflow (reusable multi-step prompt) picker dialog
- `modules/analytics/` - spend/usage dashboards
- `modules/accounts/`, `modules/github-accounts/` - multi-account management
- `modules/processes/`, `modules/limits/`, `modules/memory/`, `modules/skills/`, `modules/projects/`, `modules/agents/`, `modules/runs/`, `modules/search/`, `modules/settings/`, `modules/docs/`, `modules/flutter/`, `modules/onboarding/`
- `lib/` - Zustand stores (theme, active-project, tabs, claude-limits, processes, dev-server, branch, palette, flutter, performance, compare, toast, ...), the axios `api-client`, and `api/` resource modules

## Run it

Requires **Node 22+** and **pnpm**.

```sh
pnpm install
pnpm dev              # → http://localhost:3000
pnpm dev:landing      # → marketing site

pnpm build            # next build of apps/web
pnpm start            # production server
pnpm typecheck        # tsc --noEmit across the workspace
pnpm lint
pnpm --filter @agent-office/web test   # vitest (unit tests in packages/domain, etc.)
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
- **Workflows** (a curated library of reusable multi-step prompts, formerly "saved prompts") live in the `saved_prompts` SQLite table; the picker dialog is one keystroke away in the composer (Ctrl+P) and organised by category.
- **Skills** are installable bundles from configured registries; updates are checked against source manifests and surfaced in the Skills page.
- **Sleep inhibitor** acquires a `systemd-inhibit` lock for the duration of any active run so the laptop doesn't sleep mid-task.
- **Crash recovery**: on DB open, any run still marked `running` is flipped to `error` with `exit_code=-1`; any pipeline still `running` is marked `interrupted=1`.

## Status

Personal project, MIT spirit but no license declared. Not production-grade for shared use - assumes a single local user with `claude` on `$PATH` and a populated `~/.claude/agents/` directory.
