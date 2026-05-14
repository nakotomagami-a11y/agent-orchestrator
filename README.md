# Agent Office

Personal fleet manager for Claude Code subagents. A GNOME-styled desktop app where agents get cubicles in a pixel-art isometric office. Pick a project, scope a roster of agents to it, summon them with a prompt, watch output stream back in real time.

## Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS** for utility classes; custom CSS design system (Ubuntu Yaru / GNOME aesthetic — Yaru orange `#E95420` + aubergine)
- **Zustand** for client stores (theme, active-project, claude-limits), **TanStack Query** for server cache
- **better-sqlite3** SQLite at `~/.claude/agent-office/db.sqlite` — stores runs, messages, transcripts, drafts, and UI settings. Replaced localStorage and JSONL flat files.
- Backend runs in-process inside Next.js; shells out to `claude -p` per summon and streams stdout back over SSE

## Monorepo structure

```
apps/web/             Next.js app (UI + API routes + SSE runner)
packages/shared/      Types, route config, services, DB layer
```

Inside `apps/web/src`:

- `app/(app)/` — protected pages: office, activity, projects, agents, settings, spend
- `app/api/` — REST endpoints: runs, agents, processes, ui-settings, transcripts, drafts
- `components/layout/` — titlebar, sidebar, GNOME window chrome
- `components/ui/` — design-system atoms: Icon, StatusDot, EmptyState, Modal, Skeleton, etc.
- `modules/office/` — isometric office scene, build toolbar, agent details modal
- `modules/summon/` — chat panel, transcript store, composer
- `modules/processes/` — running servers modal
- `modules/limits/` — Claude usage limits modal
- `lib/` — Zustand stores (theme, active-project, claude-limits)

## Run it

Requires **Node 22+** and **pnpm**.

```sh
pnpm install
pnpm dev          # → http://localhost:3001
```

Other scripts:

```sh
pnpm build        # next build of apps/web
pnpm start        # production server
pnpm typecheck    # tsc --noEmit across the workspace
pnpm lint
```

## How summoning works

Agent definitions are markdown files in `~/.claude/agents/`. The app scans that directory to build the roster, then shells out to:

```sh
claude -p "<prompt>"
```

Output streams back over Server-Sent Events. Runs and full transcripts are stored in SQLite.

## Office build mode

The isometric office floor is user-editable. Controls:

- **Arrow keys** to pan, **`-`** / **`=`** to zoom, **scroll wheel** to zoom to cursor
- **B** (Paint): click or drag to paint grass tiles
- **E** (Erase): click or drag to erase (removes agents first, then decorations LIFO, then terrain)
- Click a decoration in the build panel to select it, then click a grass tile to place (max 2 per tile, one per decoration family)
- Drag agents from the sidebar onto grass tiles; drag them between tiles on the floor

Scene state (grid, decorations, agent positions, grass color) persists to SQLite via `/api/ui-settings`.

## License

Personal project, no license declared.
