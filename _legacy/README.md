# Agent Office

A pixel-art office where Claude Code subagents live in cubicles. Walk up to one, press `E`, and summon them with a task.

## Stack

- **Frontend** (`client/`): Vite + React + PixiJS. Reuses AI Town's tilemap (`gentle.js`) and character spritesheet (`32x32folk.png`).
- **Backend** (`server/`): Bun's native HTTP + WebSocket server. Shells out to `claude -p --agent <name>` per summon and streams stdout back via WS.
- **Agents**: defined as markdown files in `~/.claude/agents/`. Each frontmatter `name` is what Claude Code uses; the `description` shows up in the dashboard.

## Run it

Two terminals:

```sh
# Terminal 1 — backend
cd server
bun install   # nothing to install, but harmless
bun run dev

# Terminal 2 — frontend
cd client
bun install
bun run dev
```

Open http://localhost:5173. Walk with arrow keys / WASD. Press `E` (or space) next to the researcher to summon them.

## How summoning works

1. You walk up to an agent and press `E`.
2. A modal opens with a prompt box.
3. On submit, the frontend opens a WebSocket to the backend.
4. The backend spawns `claude -p --agent <name> "<prompt>"` as a subprocess.
5. Stdout streams back over the WS to the modal.
6. When the subprocess exits, the WS closes and the agent returns to idle.

No API keys needed — invocations bill against your existing Claude Code subscription.

## Adding a new agent

1. Drop a markdown file in `~/.claude/agents/<name>.md` with a frontmatter block:

   ```markdown
   ---
   name: <name>
   description: One-line description
   tools: WebSearch, WebFetch
   ---

   System prompt here.
   ```

2. Add a cubicle entry in `client/src/Office.ts` (the `AGENTS` array) with `tileX`, `tileY`, and a `spriteSrcX/Y` for the character sprite frame.

That's it.
