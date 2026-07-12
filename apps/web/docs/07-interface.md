# Interface

Every screen, modal, panel, and shortcut in the app. Read this if you want to know "where does X live?" — you'll find it here.

## Layout — the GNOME window shell

The whole app runs inside a GNOME-styled Tauri window:

- **Titlebar** (top, 38 px) — window controls, workspace name, global search.
- **Sidebar** (left, resizable) — pinned agents grouped by room, project switcher, memory + skills + settings entry points.
- **Main pane** — current route (Office / Projects / History / Docs / Settings / etc.).
- **Mobile bottom nav** — appears on narrow viewports; replaces the sidebar.
- **Resize handles** — grab any window edge to resize (Tauri desktop only).

The layout persists via `ui_settings` — sidebar width, active route, last-opened project.

## The sidebar (roster group)

Each agent line shows:

- Tiny Swords sprite avatar (colored by faction)
- Human-readable display name (e.g. `cs-ceo` → **CEO**)
- Status LED (see [Office → Status LEDs](#/usage))
- Instance count badge (if the agent has multiple instances)

Right-click an agent for:

- **Spawn new instance** in the active project
- **Open agent details**
- **Remove from project**
- **Copy slug**

### Multi-instance expansion

If an agent has 2+ instances in the active project, its line becomes expandable — click the caret to see per-instance rows with labels + individual status LEDs.

## Agent details modal

Click any agent (in the sidebar, on the office floor, or in the agent list) to open the details modal. Four tabs across the top:

### Conversation tab

The chat panel. Send a prompt, watch it stream back. Persists across app restarts.

- **Composer** at the bottom with autoresizing textarea
- **Message queue** — you can send multiple messages while one is running; they queue and dispatch in order
- **Drafts** — text in the composer is autosaved to `~/.claude/agent-office/db.sqlite → drafts` and restored when you reopen the tab
- **Attachments** — drop files onto the composer or paste from clipboard (see Clipboard image paste below)
- **Slash commands** — start typing `/` to open the command palette scoped to summon actions

### History tab

Every past run for this agent+instance. Each row shows:

- Timestamp
- Prompt (truncated)
- Status + exit code
- Cost + duration + token counts
- Model + effort
- Expandable to view full transcript

Filters: by date range, by model, by cost threshold. Bulk-delete supported.

### Memory tab

The per-agent memory file. Plain textarea, `Cmd/Ctrl+S` to save, 256 KB max. See [Memory](#/memory).

### Settings tab

Five sub-sections, each an expandable card:

#### Identity

- `name`, `description` — text inputs
- `id` (slug) — auto-derived from name; editable
- Live preview of the agent card on the right

#### Model & effort

- Model dropdown — aliases only (`haiku` / `sonnet` / `opus` / `fable`)
- Effort dropdown — `low` / `medium` / `high` / `xhigh` / `max`
- Cost estimate per typical run

#### Skills & tools

- **Skills** — searchable chip input with autocomplete. Each suggestion shows a color-coded cost pill (green→red by tier) and the skill category. Selected skills show inline with their cost. Conflict warnings appear above the chip input if two selected skills disagree.
- **Tools** — chip input for the `--allowedTools` list (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Task`, etc.). Suggested tools shown as dashed "empty-slot" chips below the selected list.

#### Appearance

- **Avatar picker** — 5-faction × 5-kind grid of Tiny Swords sprites. Click to select. "Reset to auto" reverts to a hash-derived default based on the agent name.
- Current selection shown in the footer with faction label and kind name.

#### System prompt

- Full-height markdown code editor with syntax highlighting (headings, code fences, links, bold/italic).
- **History dropdown** — every version of the body is backed up to `<id>.body.<ISO>.md` (max 10). Pick one to restore.
- **Save** button (or `Cmd/Ctrl+S`) — writes to `~/.claude/agents/<id>.md`.

### Modal URL sync

Modal state is reflected in the URL as query params (e.g. `?modal=agent&agent=developer&instance=developer-3f9a&tab=settings`). Deep-linkable — send someone a URL and they open right on the same screen.

## Chat features (Conversation tab)

### Message queue

While one run is streaming, you can queue additional prompts. They dispatch in order once the current run completes. Queued messages show a small chevron and remain editable until they start.

The queue is per-instance and persists across app restarts.

### Draft persistence

Text in the composer is autosaved on blur or after 500 ms of inactivity. Restored when you reopen the tab. Cleared when you send.

### Attachments

- **Drag-drop** any file onto the composer to attach it.
- **Ctrl/Cmd+V** to paste — text pastes as text, images paste as PNG (Wayland only).
- Attachments upload to `~/.claude/agents/_uploads/<agent-id>/` (or `~/.claude/projects/<id>/_uploads/` if summoned from a project context).
- Multiple attachments are supported per message.

### Clipboard image paste

On Wayland, `POST /api/clipboard-image` reads the clipboard PNG via `wl-paste` and returns it as `image/png`. In the app, `Cmd/Ctrl+V` in the composer automatically converts a clipboard image into an inline attachment.

### Slash commands

Start typing `/` in the composer to open a scoped command palette:

- `/summon <agent>` — dispatch a prompt to a different agent from this composer
- `/clear` — clear the queue
- `/save` — save the current draft as a saved prompt

### Saved prompts

Frequently-used prompts can be saved and re-used across agents/projects.

- **Save** — right-click a message → *Save as prompt*, or use `/save` in the composer.
- **Use** — command palette (`Cmd+K`) → *Prompt* section, or `POST /api/saved-prompts/:id/use` which increments the usage counter.
- **Manage** — Settings → Saved Prompts. Bulk edit, delete, rename.

## Command palette (Cmd+K)

Press **Cmd+K** anywhere in the app to open the command palette. Groups:

**Navigate** — jump to any top-level route:

- Go to Office
- Go to Agents
- Go to Projects
- Go to Memory
- Go to Skills
- Go to Runs
- Go to Spend
- Go to Search
- Go to Activity
- Go to Docs
- Go to Settings

**Agents** — one row per installed agent; Enter opens the agent details modal.

**Projects** — one row per project; Enter sets it as the active project.

**Saved prompts** — every prompt from `saved-prompts`. Enter fires `POST /api/saved-prompts/:id/use` (increments the usage counter and updates `lastUsed`), then pastes into the currently-focused composer.

**Full-text messages** — SQLite FTS5 across the `messages` table. Enter jumps to the transcript.

**Recent runs** — last 20 completed runs. Enter jumps to the transcript.

**Actions** — one-shot toggles: Toggle Theme, Toggle Build mode, Open Processes panel, Open Claude Limits modal, Clear Draft, etc.

Navigate with ↑/↓, Enter to select, Esc to close. The palette state is persisted in `palette-store` so reopening within the same session restores the last query.

## Compare runs modal

Select 2 or more runs from the History tab, then click **Compare**. Opens a side-by-side view:

- Left column — Run A
- Right column — Run B
- Deltas — cost, tokens, duration, exit code, tool calls
- Diff view of prompt + output for quick visual comparison

Useful for A/B testing model choices or reproducing a regression.

## Claude limits modal

Toolbar → ⚡ icon opens the Claude Limits modal. Shows:

- Current Anthropic plan (Free / Pro / Max)
- Per-model 5-hour rolling usage bars
- Estimated remaining budget for the current billing period
- A breakdown of the last week's spending by model

Data source: your own `.credentials.json` for plan; SQLite `runs` table for usage.

## Migration modal (first launch after upgrade)

When the bundled agent MANIFEST version changes, the migration modal opens once. Three sections:

- **New in this version** — bundle has agents you don't have
- **Changed since last install** — agent hash differs from local
- **Only in your local install** — read-only surface of your customs

Per-row toggles + "Accept all" / "Skip all". On submit:

- Accepts → local backed up to `_archive/`, bundled copied in
- Skips → recorded so they don't re-nag for this version
- Version stamped so the modal won't re-fire until the bundle changes again

See [Usage → Roster migration](#/usage) for the full model.

## Settings page (`/settings`)

The Settings route is a two-tab layout:

### Tab 1 — Projects

- **Projects root** — the parent directory the app scans for candidate projects. Persisted to `~/.claude/agent-office-settings.json` as `projectsRoot`.
- **Exclusions** — chip input of directory names to skip during scan (e.g. `node_modules`, `.next`, `.git`). Persisted as `excluded[]`.
- **Preview** — live list of what the scanner picks up under the current root minus exclusions, so you see the effect of your edits before saving.
- **Save** — writes back via `PUT /api/settings`; `firstRunComplete` is left untouched.

### Tab 2 — About You

Runs the `user-analyst` agent against your local data (message history, run patterns, project inventory) and produces a candid person-portrait. No calls home; everything stays local.

- **Refresh** button — re-runs the analysis (`POST /api/user-analysis`)
- **View history** — every past analysis is saved with a timestamp
- **Export** — download the current analysis as Markdown

> [!NOTE]
> Global Memory, Skills, Spend, Search, and Activity are top-level routes (`/memory`, `/skills`, `/spend`, `/search`, `/activity`) reached from the sidebar — NOT sub-tabs of Settings. Common misconception because the sidebar groups them together with a "Settings" heading.

### Multi-instance feature flag

`AppSettings.features.multiInstance` (optional, defaults off) toggles whether an agent can be dropped onto the same project more than once. Enable to unlock the multi-instance workflow (per-instance labels, worktrees, chat panels).

## Bootstrap Project modal (`/projects` → New Project)

Scaffolds a fresh project directory from a framework template.

- **Frontend choice** — `next` (Next.js App Router, server components, full-stack), `vite` (SPA, no SSR), `react` (plain library / widget), `none`.
- **Backend choice** — enumerated on the modal (Fastify / Hono / Express / Django / FastAPI / none).
- **Name + directory** — where to write the scaffold.
- **Confirm** — hits `POST /api/projects/bootstrap`; scaffold runs, project row is created, sidebar refreshes.

## Office view — iso vs cards

Two rendering modes for the Office floor, toggled from the office toolbar and persisted in `useOfficeStore.view` (backed by `ui_settings.office-view` on the server):

- `iso` — full isometric floor via PixiJS. Interactive drag-drop, decorations, room walls, agent avatars.
- `cards` — flat grid of agent cards. No isometric transform, no PixiJS renderer. Faster on low-power machines.

The Performance settings can force-select `cards` — see the Performance section below.

## Full-text search bar (titlebar)

The search bar at the top runs against `messages_fts`. Type a phrase, get every message across every run that mentions it. Click a result to jump to the transcript.

Filters (chip-selectable):

- **Agent** — restrict to one agent's messages
- **Project** — restrict to one project
- **Model** — only messages from a specific model
- **Date range** — last 7d / 30d / custom
- **Kind** — `you` / `agent-text` / `tool` / `system`

## Global Memory page (the `/memory` route)

The global memory editor. Same textarea as the per-agent memory tab. Applies to every agent, every project. Read on every `summon` call.

## Skills page (the `/skills` route)

- Installed skills list (from `~/.claude/agents/_skills/`)
- Registry browser (from configured GitHub sources)
- Per-skill actions: uninstall, update to latest SHA, view source, edit locally
- Source manager: add/remove GitHub sources for skill discovery
- Registry cache indicator with `?refresh=1` bypass

## Spend page (the `/spend` route)

Cost dashboards:

- **Total spend** — this workspace, all time
- **By model** — pie chart + table
- **By agent** — top 10 by cost
- **By project** — top 10 by cost
- **Trend** — 30-day line chart

All data pulled from the `runs` table. No cloud call.

## Search page (top-level route `/search`)

Full-text search over every stored message. Same engine as the titlebar search bar; standalone route for bookmarking specific queries.

## Activity page (top-level route `/activity`)

Feed of recent activity across all projects: new instances added, runs completed, spend cap alerts, migration events. Useful as a "what happened while I was away" timeline.

## Processes panel (Cmd+Shift+P)

Every dev server, build, and background process spawned by the app. Live status, stream stdio via `GET /api/processes/:pid/logs?since=<offset>`. Send stdin via `POST /api/processes/:pid/stdin`. Kill via `DELETE /api/processes/:pid`.

## Flutter modal (Tools → Flutter)

If the active project is a Flutter app, the Flutter modal exposes:

- **Devices** — enumerated Flutter/Dart devices
- **Mirror** — live-stream a device's screen into the modal
- **Run** — spawn `flutter run` in a terminal
- **Screenshot** — capture the current device screen

Endpoints: `/api/flutter/{devices,mirror,run,screenshot}`.

## Keyboard shortcuts summary

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+K` | Open command palette |
| `Cmd/Ctrl+Shift+P` | Open Processes panel |
| `Cmd/Ctrl+S` | Save (in memory / body editors) |
| `Alt+←` / `Alt+→` | Previous / next instance of the same agent |
| `Esc` | Close any modal |
| `↑` / `↓` (in composer, empty) | Cycle through recent prompts |
| `Enter` in composer | Send |
| `Shift+Enter` in composer | Newline |
| `Cmd/Ctrl+Enter` in composer | Send + queue |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+D` | Toggle Docs modal |

## Themes

The theme store lives at `apps/web/src/lib/theme-store.ts` and behaves as follows:

- **First load** — reads `ui_settings.theme` from the server. If absent, auto-detects the OS via `window.matchMedia("(prefers-color-scheme: dark)")`.
- **Applies** — writes `[data-theme="dark"]` on `<html>` so Tailwind's `dark:` variants and the token CSS in `packages/ui/src/tokens.css` flip accordingly.
- **Toggle** — the sun/moon icon in the titlebar; also exposed via the command palette.
- **Persistence** — writes back to `ui_settings.theme` on change (best-effort; failures don't block the DOM update).

## Reduced motion (accessibility)

The app partially honors `@media (prefers-reduced-motion: reduce)` — several animations (pulse, shimmer, chat-jump-latest, cursor blink) drop to a single frame. The Performance settings below extend this to every animation regardless of OS setting.

## Performance mode

Global setting persisted to `ui_settings.performance-mode`. Three levels:

| Mode | Effect |
|---|---|
| `full` (default) | Everything on: iso office renderer + PixiJS, framer-motion transitions, CSS keyframes, backdrop-blur, drop shadows, procedural planet icons, hover transitions. |
| `lite` | Office view forced to `cards`. Non-essential CSS animations off. Framer-motion transitions set to 0 ms. Backdrop-blur removed. Planet icons render as flat color fallback. Status LEDs still animate (essential feedback). |
| `off` | Everything from `lite` PLUS: no hover transitions, no shimmer, no chat message-in animations, no auto-scroll smoothing. Utilitarian rendering. |

Auto-detect: on first launch, if the browser reports `prefers-reduced-motion: reduce`, the default flips to `lite` and a small notice surfaces on the About You tab (not blocking).

Change from Settings → Performance. Takes effect immediately (no reload needed) via the `[data-perf]` attribute on `<html>` gating CSS rules.

## Notifications

Long-running runs (> 30 s) trigger a system notification on completion if the app tab is backgrounded. Requires OS notification permission on first-run.
