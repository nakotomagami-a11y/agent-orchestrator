# Agent Office — Design Brief

## Product summary

**Agent Office** is a single-user local web dashboard for managing a personal fleet of specialized AI agents. Each agent is a Claude Code subagent (defined as a markdown file in `~/.claude/agents/`) tuned for one kind of task: research, code review, web/app QA, scraping, etc.

The user "summons" an agent on demand with a task and per-summon options (model, effort, budget cap). The agent executes via `claude -p` as a subprocess, billed against the user's existing Claude Code subscription — no external API keys.

The original vision was a **gamified pixel-art office** where agents lived in cubicles and the user walked around to summon them. That's the long-term aspiration but the immediate need is a clean, dense **dashboard** that scales as the agent roster grows from 1 to 50+ agents.

## Primary user

One person, the owner of this dev box, working solo. Not a team product. Not a SaaS. Runs locally, opens in the browser when needed, gets closed when work is done. Dark-mode-only is fine.

## What's built today

A two-pane Radix Themes layout:

- **Left sidebar** — vertical list of agent cards: name, description (truncated to 2 lines), status badge (`idle` / `working` / `done` / `error`), skills as small badges
- **Right panel** — three tabs for the selected agent:
  - **Summon**: model dropdown, effort dropdown, max-budget input, prompt textarea, Summon/Abort button, streaming output area
  - **Config**: skills, allowed tools, defaults (model/effort/permission-mode) — all read-only
  - **System Prompt**: full markdown body of the agent's `.md` file

This works for 1–3 agents. It breaks down for 10+, which is what we need to fix.

## Pain points the new design must solve

1. **Sidebar doesn't scale.** A flat scrollable list of identical cards becomes unusable at 15+ agents. Need search, filtering by skill, grouping, or some richer layout.
2. **No fleet overview.** You can only see one agent at a time. No way to see "who's currently working" or "who I last used" at a glance.
3. **Status is invisible at scale.** A tiny badge on a hidden card tells you nothing when 5 agents are running in parallel.
4. **No history.** Each summon's output is ephemeral — closing the panel loses it. We need a session/run log per agent.
5. **No multi-agent operations.** Can't summon two agents in parallel from one screen. Can't compare outputs side-by-side.
6. **Prompt input is barren.** No prompt templates, no recent-prompts history, no saved prompts per agent.
7. **Config is read-only.** Editing requires opening the `.md` file in another editor.
8. **Aesthetic is generic.** It looks like a SaaS admin panel. The product wants more personality — see "Aesthetic direction" below.

## Functional requirements (for the redesign)

Must support, even if some are future:

- Roster of 1 to ~50 agents, each with: name, description, status, skills (tags), allowed tools, default model/effort, custom system prompt
- Per-summon overrides: model, effort, max budget USD, working directory (future), prompt
- Live streaming output, abort, copy, clear
- Per-agent run history (timestamps, prompt, output, exit status, cost — when available)
- Multiple summons in flight at the same time, across different agents
- Search agents by name / skill / tool
- Group/filter agents (by skill cluster, by recently-used, by status)
- Eventually: agent creation/edit form (instead of editing markdown files manually)
- Eventually: a "fleet view" or "office view" — possibly the gamified pixel-art office as an alternate visualization mode

## Aesthetic direction

The user's stated long-term vision is **gamified, office-themed, slightly playful**. Inspirations they're drawn to:

- AI Town / Stanford "Smallville" — pixel-art, top-down, cozy
- The mental model of "agents in cubicles" — each agent has a personality and a workspace
- Not corporate-SaaS-blue; more like a developer hobby tool with character

For the dashboard redesign, the right balance is probably:

- **Functional first** — must be dense and fast; this is a working tool, not a screensaver
- **Personality through small details** — typography, iconography, micro-animations, distinct status states
- **A nod to the office metaphor** — agent avatars / desk indicators / a sense of "where the agent is" (idle = at desk, working = in meeting room, etc.)
- **Optional alternate views** — list view (default, dense), grid view, floor-plan/office view (the gamified one)

Dark mode primary. Jade/teal accent is current; designer can change.

## Constraints / stack

- **Web app**, runs in a local browser (Chrome/Brave). No mobile.
- **React + Vite + Radix UI Themes** (component library — designer can stay within Radix or propose deltas)
- **Single window**, no auth, no multi-tenant concerns
- **Live streaming text** is core to the experience — output panels need to handle long, continuously-growing content gracefully
- The data model is simple: agent definitions are flat markdown files; runtime state is in-memory

## Specific design questions for the designer

1. What's the right primary visualization for the agent roster as it grows? (List with rich filters? Grid of larger tiles? Hub-and-spoke? Floor plan?)
2. How do we surface "who's working right now" without forcing the user to click each agent?
3. How should we present per-agent run history — inline timeline? separate "Activity" tab? a global activity feed across all agents?
4. How do we layer the playful office metaphor on top of dense functional UI without sacrificing density? (Toggleable view modes? Persistent floor-plan minimap? Just iconography?)
5. What's the agent-creation flow? (Inline form? Wizard? Direct markdown editor with preview?)
6. How do we represent guardrails and skills visually so they're informative at a glance, not just word lists?

## Out of scope

- Auth / sharing / multi-user
- Mobile / responsive below ~1024px
- Integration with external systems (Linear, GitHub, Slack)
- Dark/light theme toggle (dark only)
