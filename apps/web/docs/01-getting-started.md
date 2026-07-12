# Getting Started

## What is Agent Office?

Agent Office is a desktop app that gives your Claude Code agents a visual home. Define agents as plain `.md` files, roster them to projects, summon them with a prompt, and watch output stream back in real time — all stored locally in SQLite.

This documentation covers everything from installation to internals: agent file format, the skills system, project and memory management, the isometric office floor, how runs are spawned and streamed, and what lives where on disk.

> [!NOTE]
> Agent Office wraps the Claude Code CLI — you need that installed and an Anthropic API key configured before anything will run.

## Prerequisites

### 1. Claude Code CLI

Agent Office spawns `claude` as a subprocess for every run. Install it first:

```bash
npm install -g @anthropic/claude-code
```

Verify with `claude --version`. The health check at `GET /api/health` also confirms availability.

### 2. Anthropic API key

Configure an Anthropic API key in your environment. Agent Office reads this from `~/.claude/.credentials.json` when the CLI is installed.

```bash
export ANTHROPIC_API_KEY="sk-ant-…"
```

### 3. Platform availability

- Linux (Wayland or X11)
- macOS
- Windows via WSL2

Some features are Linux-only (clipboard image paste via `wl-paste`, `lsof` for the Processes panel).

## Quick start

Three steps from a fresh install to your first run.

### Step 1 — Import a starter agent

Launch the app; the first-run wizard opens automatically. Pick one or more starter agents (`developer` is a good default) and click **Import**. Each import copies a `.md` file into `~/.claude/agents/`.

### Step 2 — Create a project

Click **New project**, pick a directory on disk, name it. Agent Office stores project metadata under `~/.claude/projects/<id>/project.md`.

### Step 3 — Summon an agent

Drag the agent from the sidebar into the project roster. Click the agent to open the chat panel. Type a prompt, hit **Send**. Output streams back live via SSE.

That's it. Everything else — office floor layout, memory tiers, pipelines, cost tracking — is on top of these three primitives.

## First-run wizard

The wizard walks new installs through the same three steps above, plus a few app-level settings.

### Wizard steps

1. **API key check** — confirms `~/.claude/.credentials.json` exists.
2. **Starter agent import** — lists agents bundled at `apps/web/starter-data/agents/` and lets you pick which to install. Already-present files are skipped.
3. **Project root** — pick a default parent directory for future projects (e.g. `~/Documents/Lab`).
4. **Confirm** — writes settings + agents, marks `firstRunComplete: true`.

### What gets created on finish

- `~/.claude/agents/*.md` — one file per imported starter.
- `~/.claude/agent-office-settings.json` — `projectsRoot`, `excluded`, `firstRunComplete`.
- No projects yet — you create the first one manually after the wizard closes.

### Re-running the wizard

Delete or edit `~/.claude/agent-office-settings.json` and remove `firstRunComplete`. The wizard reopens on next launch.
