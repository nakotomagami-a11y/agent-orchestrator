# Agent Office

Personal fleet manager for Claude Code subagents — a GNOME-styled desktop app where each subagent gets a cubicle in a pixel-art office. Pick a project, scope a roster of agents to it, summon them with a prompt.

## Stack

- **Web app** (`apps/web/`) — Next.js 15 (App Router), React 19, TypeScript. UI styled after Ubuntu Yaru / modern GNOME (Yaru orange + aubergine). State: Zustand for app stores, TanStack Query for server cache. Pixel sprites are pure SVG.
- **Shared** (`packages/shared/`) — typed config (routes, query keys) and services that read/write `~/.claude/agents/` (agent definitions) and the local project metadata.
- **Backend** — runs in-process inside the Next.js app. Shells out to `claude -p` per summon and streams stdout back via SSE.

## Run it

Requires **Node 20+** and **pnpm**.

```sh
pnpm install
pnpm dev          # → http://localhost:5173
```

Other scripts:

```sh
pnpm build        # next build of apps/web
pnpm start        # production server
pnpm typecheck    # tsc --noEmit across the workspace
pnpm lint
```

## Layout

```
apps/web/            Next.js app (routes, API, UI)
packages/shared/     shared types, route config, services
```

Inside `apps/web/src`:

- `app/(app)/`     — protected pages (office, activity, projects, agents, settings, …)
- `app/api/`       — REST endpoints backing the React Query hooks
- `components/`    — `layout/` (titlebar, sidebar, GNOME chrome), `ui/` (atoms)
- `modules/office/` — iso-office floor, cards view, agent details modal
- `modules/projects/` — projects list + detail, Add-agent picker
- `modules/agents/`  — agent definitions (markdown files in `~/.claude/agents/`)
- `lib/`            — zustand stores (theme, active-project), API helpers

## How summoning works

Agents are markdown files in `~/.claude/agents/`. The dashboard scans that directory, builds a roster, and shells out to:

```sh
claude -p --agent <name> "<prompt>"
```

Output streams back over Server-Sent Events. Cost is tracked per run and aggregated in the office HUD.

## Projects

Pick a project in the top-left switcher to scope the office floor + the sidebar roster to that project's agents. "Add agent" on the office toolbar adds an agent instance to the active project. The active project persists in `localStorage`.

## License

Personal project, no license declared yet.
