# Agent-to-Agent communication — design proposal

**Status:** Planning. Not implemented. This document is the implementation contract
to ratify before any code lands.

**Date:** 2026-05-11

## Why

Today every summon is a one-shot `claude -p` subprocess. Agents can't pull
another instance into the loop. That makes the multi-instance roster (e.g. "2
frontends + 1 backend") feel decorative — they sit on the floor plan but can't
hand work to each other. The goal is to let an instance say "this part is QA's
job, hand it off" and have that happen without the human re-prompting.

We want the simplest mechanism that:
- works with the current `claude -p` subprocess model (no SDK rewrite)
- can be opted into per-agent (most agents stay solo)
- is observable in the existing run log + floor plan
- doesn't leak the orchestrator's identity into other tooling

## Mental model

Treat each instance as a **mailbox** identified by `instanceId`. A running agent
can put a message on another instance's mailbox; the orchestrator drains
mailboxes by spawning fresh `claude -p` summons for the addressee.

This is asynchronous queue routing, not a synchronous RPC. The sender does
**not** block waiting for a reply — the next run targeting it will see the
reply through project memory or a dedicated thread file.

```
┌──── Frontend #1 (running) ─────┐
│  tool_use: send_to_instance    │       ┌──── orchestrator ────┐
│    target: "qa-acceptance-1"   │  ───▶ │  enqueue(qa-acc-1,   │
│    body:   "Test login flow"   │       │    from: fe-1, body) │
└────────────────────────────────┘       └───────────┬──────────┘
                                                     │
                                                     ▼
                                         ┌───── new summon ─────┐
                                         │ agent: qa-acceptance │
                                         │ instanceId: qa-acc-1 │
                                         │ prompt: <body>       │
                                         │ context: from fe-1   │
                                         └──────────────────────┘
```

## Surface area

Three additions, in this order:

### 1. Tool: `send_to_instance` (sender-side)

Agents that opt in declare this tool in their frontmatter:

```yaml
tools: [Read, Edit, Bash, send_to_instance]
```

`send_to_instance` is wired by the orchestrator (not Claude Code itself), so it
needs to be implemented as an **MCP tool** that ships with Agent Office. The
agent calls it as:

```jsonc
{
  "name": "send_to_instance",
  "input": {
    "target": "qa-acceptance-1",      // instanceId or "@qa-acceptance" (first match)
    "subject": "Test login flow",     // short title for the run history
    "body": "...detailed handoff...", // becomes the addressee's next prompt
    "context": "fe-1@agent-office",   // auto-filled; not user-controlled
    "wait_for_reply": false           // future extension; v1 always false
  }
}
```

The MCP server is a thin Bun process that Agent Office launches alongside
`claude -p`. Its stdin/stdout speak the MCP protocol; on a `send_to_instance`
call it posts to `localhost:3001/api/handoff` (a new endpoint).

**Why MCP, not a custom tool format?** Claude Code already loads MCP servers
defined in the project's `.mcp.json`. We don't have to invent invocation
machinery — just author the server. The agent sees a normal tool.

### 2. Endpoint: `POST /api/handoff`

```jsonc
// Request
{
  "fromInstanceId": "frontend-craftsman-1",
  "fromRunId":      "frontend-craftsman-1-1730…",
  "projectId":      "agent-office",
  "target":         "qa-acceptance-1",
  "subject":        "Test login flow",
  "body":           "..."
}
// Response (immediate, no wait)
{
  "queuedRunId":    "qa-acceptance-1-1730…",
  "queuedAt":       "2026-05-11T01:23:45.678Z"
}
```

The server:

1. Resolves `target` → instance + agentId (404 if missing in roster)
2. Builds a fresh summon with `agent`, `projectId`, `instanceId` set, and a
   composed prompt:

   ```
   ## Handoff from frontend-craftsman-1 (frontend-craftsman)
   Project: agent-office
   Subject: Test login flow

   <body>
   ```
3. Calls `startRun(...)` with the new run, tagging the persisted run with
   `originRunId: fromRunId` so the UI can render the parent → child chain
4. Returns immediately. The originating run continues; it sees the queued run
   id in its tool output and can mention it in its final reply.

This is **just another run** in `runs.ts` — no new spawning machinery. The
floor plan animates the addressee's desk to `working` like any other summon.

### 3. UI: thread view

A new tab on the Activity drawer: **Threads**. Each thread is a tree rooted
at a human-originated run, with handoffs as children:

```
▼ frontend-craftsman-1 · "Build login page" · 12:03
  ▶ qa-acceptance-1 · "Test login flow"     · 12:08 (handoff)
    ▶ frontend-craftsman-1 · "Fix the X bug" · 12:15 (handoff back)
```

Clicking a node opens that run's transcript. The thread is built from
`originRunId` chains in the run log — no new storage.

## Data shape changes

```ts
// shared/types.ts additions
export interface PersistedRun {
  // ...existing fields...
  originRunId?: string;   // parent run when this was started by a handoff
  handoffSubject?: string;
}

export interface AgentInstance {
  // ...existing fields...
  acceptsHandoffs?: boolean;  // default true; false = mailbox closed
}
```

Setting `acceptsHandoffs: false` on an instance causes `POST /api/handoff` to
return `409 Conflict` ("mailbox closed"). The sender sees that in the tool
output and can decide to surface it to the user.

## Loops & safety

Two failure modes we **must** mitigate before shipping:

1. **Handoff storms** — two agents bouncing requests back and forth. Mitigation:
   `originRunId` chain depth check. Reject handoffs when the chain depth ≥ 5
   (configurable). Visible warning in the originator's run.

2. **Cost runaway** — handoffs multiply summons. Mitigation: per-thread budget
   ceiling stored on the root run. Each handoff decrements it; reaching zero
   returns `429 Budget exhausted`. Default ceiling: `$0.50` per thread.

Both checks live in `POST /api/handoff` server-side. The MCP tool just relays
the response back to the agent.

## What v1 does NOT include

- **Synchronous reply** (`wait_for_reply: true`). Hard with the subprocess
  model — would need to suspend the sender's stream and resume on completion.
  Defer until we see a real use case.
- **Broadcast** (one sender → multiple targets). Compose multiple
  `send_to_instance` calls instead.
- **Cross-project handoffs.** Routing is scoped to `projectId`. No-project
  summons cannot use this tool (the MCP server returns an error).
- **Memory sharing.** Each agent's per-agent memory remains private. If the
  sender wants the receiver to see something, it goes in the handoff body
  or gets written into project memory explicitly.

## Build sequence

Implementation should land in this order — each step is independently testable
and doesn't break the prior state:

1. Add `originRunId` / `handoffSubject` to `PersistedRun`; persist them; render
   in the existing History tab (no Threads UI yet). No behavior change for
   non-handoff runs.
2. Build `POST /api/handoff` endpoint + the chain-depth + budget checks. Test
   end-to-end with `curl`. No agent-facing surface yet.
3. Author the `send_to_instance` MCP server (Bun, ~100 LOC). Bundle it under
   `~/.config/agent-office/mcp-handoff/` and auto-register it in any project
   whose roster has 2+ instances.
4. Document opt-in: agents wanting to send handoffs add `send_to_instance`
   to their `tools` frontmatter. Update the curated templates.
5. Build the Threads tab in ActivityDrawer.

Steps 1–2 are the safe core. 3–4 expose the surface to agents. 5 is the polish
that makes threads legible.

## Open questions

- Should `acceptsHandoffs` default to `true` or `false`? Argument for `false`:
  explicit opt-in mirrors how `tools:` works for the sender. Argument for `true`:
  agents are already in the roster, presumably the user wants them to participate.
  **Recommendation:** default `true`, but expose the toggle prominently in the
  Instance Overrides tab.

- Should the MCP server be a separate process per summon (clean state) or
  long-lived (less startup overhead)? **Recommendation:** per-summon for v1 —
  cleaner failure semantics, and the overhead is one-time per agent run anyway.

- Where does the handoff body get appended? Today the summon prompt is one
  string. Options: (a) prepended as system context via `--append-system-prompt`;
  (b) injected as the user prompt directly. **Recommendation:** (b) — the
  handoff body **is** the new prompt. The sender's context goes into the prefix
  shown in the diagram.

## When NOT to use this

If two instances always need to see each other's state in real time, model
them as **one** instance with a richer system prompt instead. Handoffs are for
discrete, asynchronous deliverables — "go test this", "go ship this" — not
shared workspaces.
