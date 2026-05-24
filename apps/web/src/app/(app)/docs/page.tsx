"use client";

import { useRef, useState } from "react";

// ── Design tokens (inline border colour instead of border-line which appears white) ──
const B = "border-[rgba(255,255,255,0.08)]"; // soft border for dark mode
const BH = "border-[rgba(255,255,255,0.06)]"; // even softer for internal dividers

// ── Primitive helpers ──────────────────────────────────────────────────────

function C({ children }: { children: string }) {
  return (
    <code className="font-[var(--font-mono)] text-[0.84em] text-[var(--acc)] bg-[var(--acc-faint)] px-[5px] py-[1px] rounded-[4px] whitespace-nowrap">
      {children}
    </code>
  );
}

function Pre({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="relative group mt-[12px]">
      {lang && (
        <span className={`absolute top-0 right-0 px-3 py-2 font-[var(--font-mono)] text-[8.5px] font-bold tracking-[0.14em] uppercase text-txt-4 pointer-events-none select-none border-l border-b ${BH} rounded-bl-[6px]`}>
          {lang}
        </span>
      )}
      <pre className={`bg-bg-0 border ${B} rounded-[8px] px-4 py-4 overflow-x-auto font-[var(--font-mono)] text-[12px] leading-[1.8] text-txt-2 m-0 scrollbar-thin`}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className={`overflow-x-auto rounded-[8px] border ${B}`}>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-bg-2">
            {headers.map((h) => (
              <th key={h} className={`text-left px-4 py-3 font-[var(--font-mono)] text-[8.5px] font-bold tracking-[0.14em] uppercase text-txt-4 border-b ${BH}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b ${BH} last:border-b-0 hover:bg-bg-2 transition-colors duration-75`}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-txt-2 align-top leading-[1.55]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Registry rows with tag pills + github-style source
function RegistryTable({
  rows,
}: {
  rows: { source: string; tags: string[] }[];
}) {
  return (
    <div className={`rounded-[8px] border ${B} overflow-hidden`}>
      <div className={`flex items-center px-4 py-3 bg-bg-2 border-b ${BH} gap-4`}>
        <span className="font-[var(--font-mono)] text-[8.5px] font-bold tracking-[0.14em] uppercase text-txt-4 flex-1">Registry source</span>
        <span className="font-[var(--font-mono)] text-[8.5px] font-bold tracking-[0.14em] uppercase text-txt-4 w-48">Tags</span>
      </div>
      {rows.map((r, i) => {
        const [owner, repo] = r.source.split("/");
        return (
          <div key={i} className={`flex items-center gap-4 px-4 py-3 border-b ${BH} last:border-b-0 hover:bg-bg-2 transition-colors duration-75`}>
            <div className="flex-1 flex items-baseline gap-1 font-[var(--font-mono)] text-[12px]">
              <span className="text-txt-3">{owner}/</span>
              <span className="text-txt font-medium">{repo}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap w-48">
              {r.tags.map((tag) => (
                <span key={tag} className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${B} bg-bg-2 text-txt-3`}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Note({
  children,
  kind = "info",
}: {
  children: React.ReactNode;
  kind?: "info" | "warn" | "tip";
}) {
  const cfg = {
    info: { bar: "bg-[var(--ok)]",    bg: "bg-[rgba(78,185,111,0.05)]",  icon: "ℹ", iconColor: "text-[var(--ok)]" },
    warn: { bar: "bg-[#e6b35a]",      bg: "bg-[rgba(230,179,90,0.05)]",  icon: "⚠", iconColor: "text-[#e6b35a]" },
    tip:  { bar: "bg-[var(--acc)]",   bg: "bg-[var(--acc-faint)]",       icon: "→", iconColor: "text-[var(--acc)]" },
  }[kind];
  return (
    <div className={`flex gap-3 rounded-[6px] overflow-hidden ${cfg.bg}`}>
      <div className={`w-[3px] flex-shrink-0 ${cfg.bar}`} />
      <div className="flex gap-2 items-start py-3 pr-3.5">
        <span className={`flex-shrink-0 text-[11px] font-bold mt-px ${cfg.iconColor}`}>{cfg.icon}</span>
        <div className="text-[12.5px] leading-[1.65] text-txt-2">{children}</div>
      </div>
    </div>
  );
}

function Flow({ steps }: { steps: { title: string; desc: React.ReactNode }[] }) {
  return (
    <div className={`rounded-[8px] border ${B} overflow-hidden`}>
      {steps.map((s, i) => (
        <div key={i} className={`flex gap-3.5 items-start px-4 py-4 border-b ${BH} last:border-b-0 hover:bg-bg-2 transition-colors duration-75`}>
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--acc-faint)] border border-[var(--acc-tint)] text-[var(--acc)] font-[var(--font-mono)] text-[9px] font-bold grid place-items-center mt-0.5 select-none">
            {i + 1}
          </span>
          <div>
            <div className="text-[13px] font-semibold text-txt mb-0.5">{s.title}</div>
            <div className="text-[12px] text-txt-3 leading-[1.6]">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={`rounded-[10px] border ${B} overflow-hidden mb-3 bg-bg-1`}>
      <div className={`flex items-center gap-2.5 px-5 py-4 border-b ${BH}`}>
        <span className="font-[var(--font-mono)] text-[8px] font-bold tracking-[0.18em] uppercase text-[var(--acc)] bg-[var(--acc-faint)] px-2 py-[3px] rounded-[4px] flex-shrink-0">
          {eyebrow}
        </span>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-txt leading-none m-0">
          {title}
        </h2>
      </div>
      <div className="px-5 py-6 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-[1.75] text-txt-2 mb-2">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold tracking-[0.08em] uppercase text-txt-4">
      {children}
    </h3>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────

type TabId = "getting-started" | "agents" | "projects" | "usage" | "reference";

const TABS: { id: TabId; label: string }[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "agents",          label: "Agents" },
  { id: "projects",        label: "Projects & Memory" },
  { id: "usage",           label: "Usage" },
  { id: "reference",       label: "Reference" },
];

// ── Tab content ────────────────────────────────────────────────────────────

function GettingStarted() {
  return (
    <>
      <Card id="introduction" eyebrow="Introduction" title="What is Agent Office?">
        <P>
          Agent Office is a desktop app that gives your Claude Code agents a visual home.
          Define agents as plain <C>.md</C> files, roster them to projects, summon them
          with a prompt, and watch output stream back in real time — all stored locally in SQLite.
        </P>
        <P>
          This documentation covers everything from installation to internals: agent file format,
          the skills system, project and memory management, the isometric office floor, how runs
          are spawned and streamed, and what lives where on disk.
        </P>
        <Note kind="info">
          Agent Office wraps the Claude Code CLI — you need that installed and an Anthropic API
          key configured before anything will run.
        </Note>
      </Card>

      <Card id="prerequisites" eyebrow="Prerequisites" title="What you need before you start">
        <H3>1. Claude Code CLI</H3>
        <P>Install the official CLI. It must be on your <C>PATH</C>.</P>
        <Pre lang="bash">{`npm install -g @anthropic-ai/claude-code
claude --version`}</Pre>

        <H3>2. Anthropic API key</H3>
        <P>Set it in your shell profile — every agent run inherits it automatically:</P>
        <Pre lang="bash">{`# ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-..."
source ~/.bashrc`}</Pre>
        <Note kind="warn">
          Agent Office never reads, stores, or transmits your key. It only inherits the
          environment when spawning <C>claude</C> subprocesses.
        </Note>

        <H3>3. Platform availability</H3>
        <Table
          headers={["Platform", "Status", "Format"]}
          rows={[
            ["Linux (x64)", "Ships first", ".deb and AppImage"],
            ["macOS", "After Linux", "Universal binary"],
            ["Windows", "After macOS", "NSIS installer"],
          ]}
        />
      </Card>

      <Card id="quick-start" eyebrow="Quick Start" title="Up and running in three steps">
        <div className="flex flex-col gap-6 pt-1">
          {[
            {
              n: "01",
              title: "Create your first agent",
              body: (
                <>
                  <P>Drop a Markdown file into <C>~/.claude/agents/</C>. The filename becomes the agent ID.</P>
                  <Pre lang="bash">{`mkdir -p ~/.claude/agents
cat > ~/.claude/agents/developer.md << 'EOF'
---
name: developer
description: Senior full-stack engineer.
default-model: claude-sonnet-4-5
default-effort: high
tools: [Read, Write, Edit, Bash]
permission-mode: bypassPermissions
---

You are a senior full-stack developer specializing in TypeScript.
EOF`}</Pre>
                </>
              ),
            },
            {
              n: "02",
              title: "Open Agent Office",
              body: (
                <P>
                  Launch the app. It scans <C>~/.claude/agents/</C> on startup and builds your roster
                  automatically. The first-run wizard asks for your projects root directory (e.g.{" "}
                  <C>~/projects</C>).
                </P>
              ),
            },
            {
              n: "03",
              title: "Summon the agent",
              body: (
                <P>
                  Click an agent in the roster, select a project, type a prompt, and press Enter.
                  Output streams back line by line. When the run finishes the full transcript is
                  saved to SQLite.
                </P>
              ),
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="flex gap-4">
              <div className="font-[var(--font-mono)] text-[20px] font-bold text-bg-4 leading-none pt-1 w-8 flex-shrink-0 select-none">
                {n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-txt mb-1.5">{title}</div>
                {body}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function AgentsTab() {
  return (
    <>
      <Card id="agents" eyebrow="Agent Files" title="How agents are defined">
        <P>
          Every agent is a Markdown file at <C>{"~/.claude/agents/<id>.md"}</C>.
          The YAML frontmatter configures the agent; the body after the <C>---</C> fence
          becomes the system prompt passed to Claude Code on each summon.
        </P>
        <P>
          Agent Office uses the exact same format Claude Code already reads — existing
          agent definitions just work with no migration.
        </P>
        <H3>File layout</H3>
        <Pre lang="bash">{`~/.claude/agents/
├── developer.md          # Agent definition
├── developer.memory.md   # Per-agent memory (auto-created)
├── _global.memory.md     # Global memory injected into every agent
└── _skills/              # Installed skill packs
    ├── webapp-testing/
    │   └── SKILL.md
    └── _registry.json    # Skill registry cache`}</Pre>
        <Note kind="info">
          Files starting with <C>_</C> are internal. Files ending with <C>.memory.md</C> are
          memory sidecars. Only bare <C>{"<id>.md"}</C> files become agents.
        </Note>
      </Card>

      <Card id="frontmatter" eyebrow="Frontmatter" title="Frontmatter reference">
        <P>All fields are optional. Unset fields fall back to app-level defaults.</P>
        <Pre lang="yaml">{`---
name: developer
description: Senior full-stack engineer.
default-model: claude-sonnet-4-5
default-effort: high
skills:
  - webapp-testing
tools:
  - Read
  - Write
  - Edit
  - Bash
permission-mode: bypassPermissions
unit: blue/warrior
---`}</Pre>
        <Table
          headers={["Field", "Type", "Default", "Description"]}
          rows={[
            [<C>name</C>, "string", "filename", "Display name shown in the UI"],
            [<C>description</C>, "string", '""', "Short description shown on agent cards"],
            [<C>default-model</C>, "string", "app default", "Claude model slug"],
            [<C>default-effort</C>, "string", "medium", "Thinking budget: low · medium · high"],
            [<C>skills</C>, "list", "[]", "Installed skills to prepend to every summon"],
            [<C>tools</C>, "list", "[]", "Tools the agent may use (--allowedTools)"],
            [<C>permission-mode</C>, "string", "default", "default · bypassPermissions · plan"],
            [<C>unit</C>, "string", "auto", 'Avatar sprite: "faction/kind"'],
          ]}
        />
        <H3>permission-mode values</H3>
        <Table
          headers={["Value", "Behaviour"]}
          rows={[
            ["default", "Claude Code prompts for permission on destructive actions"],
            ["bypassPermissions", "All permissions auto-approved — use for trusted automation"],
            ["plan", "Read-only planning mode — agent cannot write or execute"],
          ]}
        />
      </Card>

      <Card id="system-prompt" eyebrow="System Prompt" title="How the system prompt is assembled">
        <P>
          When you summon an agent, Agent Office builds an appended prompt passed to Claude Code
          alongside your message. Composition order is fixed:
        </P>
        <Flow
          steps={[
            { title: "Skills", desc: <>Bodies of all installed skills in the agent's <C>skills</C> list, concatenated in order</> },
            { title: "Global memory", desc: <>Contents of <C>~/.claude/agents/_global.memory.md</C> — applies to every agent</> },
            { title: "Project context", desc: "Active project name, working directory, and description" },
            { title: "Project memory", desc: <>The memory body from <C>{"~/.claude/projects/<id>/project.md"}</C></> },
            { title: "Per-agent memory", desc: <>Contents of <C>{"~/.claude/agents/<id>.memory.md"}</C></> },
            { title: "History note", desc: "Path to the SQLite DB so the agent can query its own past runs. Omitted in plan mode." },
          ]}
        />
        <Note kind="tip">
          The <C>.md</C> body (after the closing <C>---</C>) is the <C>--system-prompt</C>.
          The items above are injected as an <em>appended</em> prompt, not a replacement.
        </Note>
      </Card>

      <Card id="skills" eyebrow="Skills" title="Reusable capability packs">
        <P>
          A skill is a directory at <C>{"~/.claude/agents/_skills/<name>/"}</C> containing
          a <C>SKILL.md</C> file. When an agent lists a skill, the body of that file is
          prepended to every summon.
        </P>
        <H3>Skill file format</H3>
        <Pre lang="markdown">{`---
name: webapp-testing
description: Browser-based QA using Playwright.
---

## How to test web apps

Use the Playwright MCP server already configured in your environment...`}</Pre>

        <H3>Installing from the registry</H3>
        <P>
          Browse and install skill packs from <strong>Settings → Skills</strong> inside the app.
          The registry indexes packs from multiple GitHub sources and caches them for 1 hour.
        </P>
        <RegistryTable
          rows={[
            { source: "anthropics/skills",                    tags: ["anthropic", "official"] },
            { source: "tradermonty/claude-trading-skills",    tags: ["trading", "community"] },
            { source: "Orchestra-Research/AI-research-SKILLs",tags: ["ai-research", "ml"] },
            { source: "numman-ali/openskills",                tags: ["example", "community"] },
          ]}
        />

        <H3>Writing a local skill</H3>
        <Pre lang="bash">{`mkdir -p ~/.claude/agents/_skills/my-skill
cat > ~/.claude/agents/_skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: What this skill teaches the agent.
---

## Instructions

Everything here is injected into the system prompt.
EOF`}</Pre>
        <P>Then reference it in any agent's frontmatter:</P>
        <Pre lang="yaml">{`skills:
  - my-skill`}</Pre>
      </Card>
    </>
  );
}

function ProjectsTab() {
  return (
    <>
      <Card id="projects" eyebrow="Projects" title="Scoping agents to a codebase">
        <P>
          A project is any directory inside your configured <em>projects root</em> (set during
          first-run setup, default <C>~/projects</C>). Agent Office scans that directory on
          startup and surfaces every subdirectory as a project.
        </P>
        <H3>Project metadata file</H3>
        <Pre lang="markdown">{`---
name: agent-office
description: Desktop workspace for Claude Code agents.
roster:
  - instanceId: developer-abc123
    agentId: developer
    label: "main dev"
  - instanceId: qa-runtime-xyz789
    agentId: qa-runtime
---

## Project conventions

- TypeScript strict mode always on
- pnpm only, never npm
- Never commit .env files`}</Pre>
        <H3>Roster instance fields</H3>
        <Table
          headers={["Field", "Description"]}
          rows={[
            [<C>instanceId</C>, "Unique ID for this agent in this project. Auto-generated."],
            [<C>agentId</C>, "Base agent filename (without .md)"],
            [<C>label</C>, "Optional display name override"],
            [<C>model</C>, "Overrides the agent's default-model for this project"],
            [<C>effort</C>, "Overrides the agent's default-effort for this project"],
            [<C>permissionMode</C>, "Overrides the agent's permission-mode for this project"],
          ]}
        />
      </Card>

      <Card id="memory" eyebrow="Memory" title="Persistent context across runs">
        <P>
          Three tiers of persistent memory — all plain Markdown files, editable directly
          in any text editor.
        </P>
        <div className="grid gap-2">
          {[
            { tier: "Global",    path: "~/.claude/agents/_global.memory.md",  desc: "Injected into every agent on every summon." },
            { tier: "Project",   path: "~/.claude/projects/<id>/project.md",  desc: "Injected for all agents assigned to that project." },
            { tier: "Per-agent", path: "~/.claude/agents/<id>.memory.md",     desc: "Injected only when that specific agent is summoned." },
          ].map((m) => (
            <div key={m.tier} className={`flex gap-3.5 items-start px-[20px] py-[14px] rounded-[8px] border ${B} bg-bg-2`}>
              <div className="font-[var(--font-mono)] text-[8px] font-bold tracking-[0.14em] uppercase text-[var(--acc)] bg-[var(--acc-faint)] px-2 py-[3px] rounded-[4px] flex-shrink-0 mt-0.5">
                {m.tier}
              </div>
              <div>
                <div className="font-[var(--font-mono)] text-[11.5px] text-txt mb-1">{m.path}</div>
                <div className="text-[12px] text-txt-3 leading-[1.5]">{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <H3>Example global memory</H3>
        <Pre lang="markdown">{`# Global memory

User: Alex. Prefers concise explanations. Linux machine.
Always use pnpm, never npm. TypeScript strict mode everywhere.`}</Pre>
        <H3>Editing from the UI</H3>
        <P>
          Open any agent's detail panel → <strong>Memory</strong> tab. Changes are saved to
          disk immediately; the next summon picks them up automatically.
        </P>
        <Note kind="tip">
          With <C>Write</C> tool access and <C>bypassPermissions</C> mode, an agent can update
          its own memory file during a run — giving it the ability to remember things across sessions.
        </Note>
      </Card>
    </>
  );
}

function UsageTab() {
  return (
    <>
      <Card id="office" eyebrow="Office Floor" title="The isometric workspace">
        <P>
          The Office is the main view: an isometric pixel floor where each rostered agent has
          a desk tile. Status LEDs show at a glance which agents are running, thinking, idle, or errored.
        </P>
        <H3>Navigation</H3>
        <Table
          headers={["Action", "Input"]}
          rows={[
            ["Pan the floor", "Click and drag on empty tiles"],
            ["Zoom in / out", "Scroll wheel or pinch"],
            ["Reset camera", "Recenter button in the toolbar"],
            ["Open agent detail", "Click on an agent sprite"],
            ["Search agents", "Search bar in the toolbar"],
          ]}
        />
        <H3>Status LEDs</H3>
        <div className="grid gap-2">
          {[
            { dot: "bg-[var(--ok)]",  pulse: true,  label: "running",  textColor: "text-[var(--ok)]",  desc: "Agent is actively executing a run" },
            { dot: "bg-[#e6b35a]",    pulse: true,  label: "thinking", textColor: "text-[#e6b35a]",    desc: "Agent is in extended thinking mode" },
            { dot: "bg-txt-2",        pulse: false, label: "done",     textColor: "text-txt-2",        desc: "Last run completed successfully" },
            { dot: "bg-[var(--err)]", pulse: false, label: "error",    textColor: "text-[var(--err)]", desc: "Last run ended with an error" },
            { dot: "bg-bg-4",         pulse: false, label: "idle",     textColor: "text-txt-4",        desc: "No recent activity" },
          ].map((s) => (
            <div key={s.label} className={`flex items-center gap-4 px-4 py-3 rounded-[8px] border ${B} bg-bg-1`}>
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
                <span className={`font-[var(--font-mono)] text-[11px] font-semibold ${s.textColor}`}>{s.label}</span>
              </div>
              <span className="text-[12.5px] text-txt-3">{s.desc}</span>
            </div>
          ))}
        </div>
        <H3>Build mode</H3>
        <P>Click <strong>Build</strong> (bottom-right) to customise the floor layout:</P>
        <Table
          headers={["Tool", "Description"]}
          rows={[
            ["Paint", "Paint grass tiles to expand land area"],
            ["Erase", "Remove agent → decoration → terrain (in that order)"],
            ["Decorations", "Place trees, buildings, rocks, bridges from the palette"],
            ["Island colour", "Change grass tint via the colour swatches"],
          ]}
        />
      </Card>

      <Card id="summon" eyebrow="Summon & Runs" title="Sending agents to work">
        <P>
          Clicking an agent on the floor opens the conversation panel. Send a prompt,
          watch output stream live, review past turns.
        </P>
        <H3>How a run works</H3>
        <Flow
          steps={[
            { title: "Spawn", desc: <>Agent Office calls <C>claude --output-format stream-json --print ...</C> as a child process with the appended prompt, tool list, model, and effort flags.</> },
            { title: "Stream", desc: "stdout is parsed line-by-line as NDJSON. Each token chunk, tool call, and usage report is broadcast over SSE to all connected browser tabs." },
            { title: "Persist", desc: "On process exit the full run record (prompt, output, token counts, cost, duration, session ID) is written to SQLite." },
            { title: "Resume", desc: <>Claude Code returns a session ID at the end of each run. The next message passes <C>{"--resume <sessionId>"}</C> so the agent retains full context.</> },
          ]}
        />
        <H3>Aborting a run</H3>
        <P>
          The <strong>Abort</strong> button sends SIGTERM to the <C>claude</C> subprocess.
          Partial output is preserved in SQLite with exit code <C>130</C>. You can resume the
          conversation from that point.
        </P>
        <H3>Spend limits</H3>
        <P>
          Set a USD budget cap per run in agent settings or the summon dialog. If running cost
          exceeds the cap the run is aborted automatically. Per-session token usage is always
          visible in the conversation header.
        </P>
      </Card>

      <Card id="history" eyebrow="Run History" title="Every run, stored forever">
        <P>
          All run data lives in <C>~/.claude/agent-office/db.sqlite</C>. Nothing is sent
          to any server. Back it up, query it directly, or delete it to start fresh.
        </P>
        <Table
          headers={["Field", "Description"]}
          rows={[
            ["id", "UUID for the run"],
            ["agentId / agentName", "Which agent ran"],
            ["projectId / instanceId", "Which project and instance"],
            ["prompt", "The full user prompt sent"],
            ["output", "Full plain-text transcript"],
            ["status", "done · error · running"],
            ["exitCode", "Subprocess exit code (130 = aborted)"],
            ["tokensIn / tokensOut", "Input and output token counts"],
            ["cost", "USD cost reported by the API"],
            ["durMs", "Wall-clock duration in milliseconds"],
            ["sessionId", "Claude Code session ID for resumption"],
          ]}
        />
        <H3>Querying directly</H3>
        <Pre lang="bash">{`sqlite3 ~/.claude/agent-office/db.sqlite

-- All runs for the developer agent
SELECT ts, prompt, status, cost
FROM runs WHERE agent_id = 'developer'
ORDER BY ts DESC LIMIT 20;

-- Total spend by agent this month
SELECT agent_name, ROUND(SUM(cost), 4) AS total_usd
FROM runs
WHERE started_at > strftime('%s','now','-30 days') * 1000
GROUP BY agent_name ORDER BY total_usd DESC;`}</Pre>
        <Note kind="info">
          Agents are told the SQLite path in every system prompt. An agent with <C>Bash</C> access
          can query its own past runs to recall what it has done across sessions.
        </Note>
      </Card>
    </>
  );
}

function ReferenceTab() {
  return (
    <>
      <Card id="storage" eyebrow="Data & Storage" title="What lives where on disk">
        <Pre lang="bash">{`~/.claude/
├── agents/
│   ├── <id>.md                   # Agent definition + system prompt
│   ├── <id>.memory.md            # Per-agent memory
│   ├── _global.memory.md         # Global memory (all agents)
│   └── _skills/
│       ├── <skill-name>/
│       │   ├── SKILL.md
│       │   └── .source.json      # Install provenance
│       └── _registry.json        # Registry cache (1hr TTL)
│
├── projects/
│   └── <project-id>/
│       └── project.md            # Roster + project memory
│
└── agent-office/
    └── db.sqlite                 # All runs, transcripts, layouts`}</Pre>
        <H3>Backup</H3>
        <Pre lang="bash">{`sqlite3 ~/.claude/agent-office/db.sqlite \\
  ".backup ~/.claude/agent-office/db.sqlite.bak"`}</Pre>
      </Card>

      <Card id="architecture" eyebrow="Architecture" title="How it's built">
        <Table
          headers={["Layer", "Technology", "Role"]}
          rows={[
            ["Desktop shell", "Tauri 2 (Rust)", "Window management, OS integration"],
            ["Backend", "Next.js 15 (Node.js)", "API routes, SSE streaming, process management"],
            ["Frontend", "Next.js 15 (React 19)", "UI rendered in the Tauri webview"],
            ["Database", "better-sqlite3", "Synchronous local SQLite, WAL mode"],
            ["AI runtime", "Claude Code CLI", "Spawned as a subprocess per run"],
          ]}
        />
        <H3>Run lifecycle</H3>
        <Pre lang="text">{`POST /api/summon
  │
  ├─ buildAppendedPrompt()
  │    Skills → Global → Project context → Project memory
  │    → Agent memory → History note
  │
  ├─ spawn: claude --output-format stream-json --print ...
  │         [--resume <sessionId>]
  │
  ├─ stdout parsed as NDJSON
  │    text chunk   → SSE "chunk"
  │    tool_use     → SSE "tool"
  │    usage        → SSE "usage"
  │
  ├─ Browser: GET /api/runs/<id>/stream  (SSE)
  │    Late joiners replay from in-memory event log
  │
  └─ On exit → write run record to SQLite → SSE "done"`}</Pre>
        <H3>PATH augmentation</H3>
        <P>
          When Tauri launches the app from a desktop shortcut it inherits a minimal environment —
          no <C>.bashrc</C>, no NVM. Agent Office augments <C>PATH</C> before spawning any
          subprocess by scanning <C>~/.nvm/versions/node/</C> and prepending all installed Node
          bin dirs, then adding <C>~/.local/bin</C>, <C>/usr/local/bin</C>, and <C>/usr/bin</C>.
        </P>
      </Card>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  "getting-started": <GettingStarted />,
  agents:            <AgentsTab />,
  projects:          <ProjectsTab />,
  usage:             <UsageTab />,
  reference:         <ReferenceTab />,
};

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("getting-started");
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-bg-0">
      {/* ── Header + tabs ───────────────────────────────── */}
      <div className={`flex-shrink-0 bg-bg-1 border-b ${B}`}>
        <div className="px-6 pb-0 pt-[28px]">
          <div className="flex items-baseline gap-2.5 mb-3">
            <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-txt leading-none">
              Documentation
            </h1>
            <span className="text-[10.5px] text-txt-4 font-[var(--font-mono)]">Agent Office v0.1</span>
          </div>

          {/* Tab bar */}
          <div className="flex">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); scrollRef.current?.scrollTo({ top: 0 }); }}
                  className={`
                    px-4 py-2 mr-1 text-[12.5px] font-medium transition-all duration-100
                    border-b-2 -mb-px cursor-pointer whitespace-nowrap rounded-t-[4px]
                    ${active
                      ? "text-txt border-[var(--acc)] bg-bg-0"
                      : `text-txt-3 border-transparent hover:text-txt-2 hover:bg-bg-0/50`}
                  `}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-[680px] px-6 pt-5 pb-10">
          {TAB_CONTENT[activeTab]}
        </div>
      </div>
    </div>
  );
}
