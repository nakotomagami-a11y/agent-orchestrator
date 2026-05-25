"use client";

import React, { useEffect, useRef, useState } from "react";
import { CodeBlock } from "./code-block";

declare const process: { env: Record<string, string | undefined> };

// ── Design tokens (inline border colour instead of border-line which appears white) ──
const B = "border-[rgba(255,255,255,0.08)]"; // soft border for dark mode
const BH = "border-[rgba(255,255,255,0.06)]"; // even softer for internal dividers

// ── Tab button classes (module-level so Tailwind v4 scanner can extract them) ──
const TAB_BASE = "px-4 py-2 mr-1 text-[12.5px] font-medium transition-all duration-100 border-b-2 -mb-px cursor-pointer whitespace-nowrap rounded-t-[4px]";
const TAB_ACTIVE = "text-[var(--txt)] border-[var(--acc)] bg-[var(--bg-0)]";
const TAB_INACTIVE = "text-[var(--txt-3)] border-transparent hover:text-[var(--txt-2)] hover:bg-[var(--bg-0)]/50";

// ── Primitive helpers ──────────────────────────────────────────────────────

function C({ children }: { children: string }) {
  return (
    <code className="font-[var(--font-mono)] text-[0.84em] text-[var(--acc)] bg-[var(--acc-faint)] px-[5px] py-[1px] rounded-[4px] whitespace-nowrap">
      {children}
    </code>
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
          <tr className="bg-[var(--bg-2)]">
            {headers.map((h) => (
              <th key={h} className={`text-left px-4 py-3 font-[var(--font-mono)] text-[8.5px] font-bold tracking-[0.14em] uppercase text-[var(--txt-4)] border-b ${BH}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b ${BH} last:border-b-0 hover:bg-[var(--bg-2)] transition-colors duration-75`}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[var(--txt-2)] align-top leading-[1.55]">
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
      <div className={`flex items-center px-4 py-3 bg-[var(--bg-2)] border-b ${BH} gap-4`}>
        <span className="font-[var(--font-mono)] text-[8.5px] font-bold tracking-[0.14em] uppercase text-[var(--txt-4)] flex-1">Registry source</span>
        <span className="font-[var(--font-mono)] text-[8.5px] font-bold tracking-[0.14em] uppercase text-[var(--txt-4)] w-48">Tags</span>
      </div>
      {rows.map((r, i) => {
        const [owner, repo] = r.source.split("/");
        return (
          <div key={i} className={`flex items-center gap-4 px-4 py-3 border-b ${BH} last:border-b-0 hover:bg-[var(--bg-2)] transition-colors duration-75`}>
            <div className="flex-1 flex items-baseline gap-1 font-[var(--font-mono)] text-[12px]">
              <span className="text-[var(--txt-3)]">{owner}/</span>
              <span className="text-[var(--txt)] font-medium">{repo}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap w-48">
              {r.tags.map((tag) => (
                <span key={tag} className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${B} bg-[var(--bg-2)] text-[var(--txt-3)]`}>
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
        <div className="text-[12.5px] leading-[1.65] text-[var(--txt-2)]">{children}</div>
      </div>
    </div>
  );
}

function Flow({ steps }: { steps: { title: string; desc: React.ReactNode }[] }) {
  return (
    <div className={`rounded-[8px] border ${B} overflow-hidden`}>
      {steps.map((s, i) => (
        <div key={i} className={`flex gap-3.5 items-start px-4 py-4 border-b ${BH} last:border-b-0 hover:bg-[var(--bg-2)] transition-colors duration-75`}>
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--acc-faint)] border border-[var(--acc-tint)] text-[var(--acc)] font-[var(--font-mono)] text-[9px] font-bold grid place-items-center mt-0.5 select-none">
            {i + 1}
          </span>
          <div>
            <div className="text-[13px] font-semibold text-[var(--txt)] mb-0.5">{s.title}</div>
            <div className="text-[12px] text-[var(--txt-3)] leading-[1.6]">{s.desc}</div>
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
    <div id={id} className={`rounded-[10px] border ${B} overflow-hidden mb-3 bg-[var(--bg-1)]`}>
      <div className={`flex items-center gap-2.5 px-5 py-4 border-b ${BH}`}>
        <span className="font-[var(--font-mono)] text-[8px] font-bold tracking-[0.18em] uppercase text-[var(--acc)] bg-[var(--acc-faint)] px-2 py-[3px] rounded-[4px] flex-shrink-0">
          {eyebrow}
        </span>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--txt)] leading-none m-0">
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
  return <p className="text-[13px] leading-[1.75] text-[var(--txt-2)] mb-2">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--txt-4)]">
      {children}
    </h3>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────

type TabId = "getting-started" | "agents" | "projects" | "memory" | "usage" | "reference";

const TABS: { id: TabId; label: string }[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "agents",          label: "Agents" },
  { id: "projects",        label: "Projects" },
  { id: "memory",          label: "Memory" },
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
        <CodeBlock lang="bash" body={`npm install -g @anthropic-ai/claude-code
claude --version`} />

        <H3>2. Anthropic API key</H3>
        <P>Set it in your shell profile — every agent run inherits it automatically:</P>
        {/* src: apps/web/src/app/(app)/docs/page.tsx#L226 */}
        <CodeBlock lang="bash" body={`# ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-..."
source ~/.bashrc`} />
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
                  <CodeBlock lang="bash" body={`mkdir -p ~/.claude/agents
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
EOF`} />
                </>
              ),
            },
            {
              n: "02",
              title: "Open Agent Office",
              body: (
                <P>
                  Launch the app. The first-run wizard walks you through setting your projects root
                  directory (e.g. <C>~/projects</C>) and optionally importing starter agents. After
                  setup it scans <C>~/.claude/agents/</C> and builds your roster automatically.
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
              <div className="font-[var(--font-mono)] text-[20px] font-bold text-[var(--bg-4)] leading-none pt-1 w-8 flex-shrink-0 select-none">
                {n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--txt)] mb-1.5">{title}</div>
                {body}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* src: apps/web/src/modules/onboarding/components/first-run-wizard.tsx */}
      <Card id="first-run-wizard" eyebrow="Onboarding" title="First-run wizard">
        <P>
          On a fresh install Agent Office shows a five-step modal before you can use the app.
          It is the only mandatory configuration step — every other setting has a sensible default.
        </P>
        <H3>Wizard steps</H3>
        {/* src: apps/web/src/modules/onboarding/components/first-run-wizard.tsx#L59 */}
        <Flow
          steps={[
            {
              title: "Requirements check",
              desc: "Polls GET /api/health every 5 s until the Claude CLI is found on PATH. You cannot advance until the check passes.",
            },
            {
              title: "Projects root",
              desc: <>Enter the absolute path to the folder that contains your code projects (e.g. <C>~/Documents</C>). This is the only mandatory field.</>,
            },
            {
              title: "Excluded folders",
              desc: <>Folder names to skip when scanning the root. Pre-filled with <C>node_modules</C>, <C>.git</C>, <C>.next</C>, <C>dist</C>, <C>build</C>, and others.</>,
            },
            {
              title: "Starter agents",
              desc: "Checkboxes for which bundled starter agents to import into ~/.claude/agents/. All agents are pre-selected; untick to skip any.",
            },
            {
              title: "First project",
              desc: "Pick one of the scanned folders to turn into your first project. You can optionally rename it. This step is skippable.",
            },
          ]}
        />
        <H3>What gets created on finish</H3>
        {/* src: apps/web/src/modules/onboarding/components/first-run-wizard.tsx#L121 */}
        <P>
          On completion the wizard calls <C>PUT /api/settings</C> (sets <C>firstRunComplete: true</C>,
          saves the root and exclusion list), then <C>POST /api/starter/agents</C> (imports the
          selected agents), and optionally <C>POST /api/projects</C> (creates the first project).
        </P>
        <H3>Re-running the wizard</H3>
        <P>
          To reset and re-show the wizard, set <C>firstRunComplete</C> to <C>false</C> in{" "}
          <C>~/.claude/agent-office-settings.json</C> and restart the app.
        </P>
        {/* src: packages/shared/src/types/index.ts#L119 */}
        <CodeBlock lang="json" body={`// ~/.claude/agent-office-settings.json
{
  "projectsRoot": "~/projects",
  "excluded": ["node_modules", ".git"],
  "firstRunComplete": false
}`} />
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
        {/* src: packages/shared/src/services/paths.ts */}
        <CodeBlock lang="bash" body={`~/.claude/agents/
├── developer.md          # Agent definition
├── developer.memory.md   # Per-agent memory (auto-created)
├── _global.memory.md     # Global memory injected into every agent
└── _skills/              # Installed skill packs
    ├── webapp-testing/
    │   └── SKILL.md
    └── _registry.json    # Skill registry cache`} />
        <Note kind="info">
          Files starting with <C>_</C> are internal. Files ending with <C>.memory.md</C> are
          memory sidecars. Only bare <C>{"<id>.md"}</C> files become agents.
        </Note>
      </Card>

      <Card id="frontmatter" eyebrow="Frontmatter" title="Frontmatter reference">
        <P>All fields are optional. Unset fields fall back to app-level defaults.</P>
        {/* src: packages/shared/src/services/agents.ts#L57 */}
        <CodeBlock lang="yaml" body={`---
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
add-dirs:
  - ~/shared-libs
room: engineering
unit: blue/warrior
---`} />
        {/* src: packages/shared/src/types/index.ts#L37 */}
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
            [<C>add-dirs</C>, "list", "[]", "Extra directories the agent can read/write, passed as --add-dir flags"],
            [<C>room</C>, "string", "auto", "Which room on the office floor the agent's desk appears in"],
            [<C>unit</C>, "string", "auto", 'Avatar sprite: "faction/kind" e.g. "blue/warrior"'],
          ]}
        />
        <H3>permission-mode values</H3>
        {/* src: packages/shared/src/services/agents.ts#L166 */}
        <Table
          headers={["Value", "Behaviour"]}
          rows={[
            ["default", "Claude Code prompts for permission on destructive actions"],
            ["bypassPermissions", "All permissions auto-approved — use for trusted automation"],
            ["plan", "Read-only planning mode — agent cannot write or execute. History note is omitted from the appended prompt."],
          ]}
        />
      </Card>

      <Card id="system-prompt" eyebrow="System Prompt" title="How the system prompt is assembled">
        <P>
          When you summon an agent, Agent Office builds an appended prompt passed to Claude Code
          alongside your message. Composition order is fixed:
        </P>
        {/* src: packages/shared/src/services/agents.ts#L147 */}
        <Flow
          steps={[
            { title: "Skills", desc: <>Bodies of all installed skills in the agent's <C>skills</C> list, concatenated in order</> },
            { title: "Global memory", desc: <>Contents of <C>~/.claude/agents/_global.memory.md</C> — applies to every agent</> },
            { title: "Project context", desc: "Active project name, working directory, and description" },
            { title: "Project memory", desc: <>The memory body from <C>{"~/.claude/projects/<id>/project.md"}</C></> },
            { title: "Per-agent memory", desc: <>Contents of <C>{"~/.claude/agents/<id>.memory.md"}</C></> },
            { title: "History note", desc: "SQLite DB path and a sqlite3 command so the agent can query its own past runs. Omitted when permission-mode is plan." },
          ]}
        />
        <Note kind="tip">
          The <C>.md</C> body (after the closing <C>---</C>) is the <C>--system-prompt</C>.
          The items above are injected as an <em>appended</em> prompt, not a replacement.
        </Note>
        <H3>Prior context injection</H3>
        {/* src: apps/web/src/app/api/summon/route.ts#L67 */}
        <P>
          When a run is <em>not</em> using <C>--resume</C>, the last 8 messages for that agent
          and instance are fetched from SQLite and prepended to the prompt text as prior context.
          This gives the agent conversational continuity without requiring an active session ID.
        </P>
        <H3>Plan mode behaviour</H3>
        {/* src: packages/shared/src/services/agents.ts#L166 */}
        <P>
          When <C>permission-mode: plan</C> is set, the history note section is omitted from the
          appended prompt entirely. This keeps the planning context lean and prevents the agent
          from accidentally referencing or querying the database in read-only mode.
        </P>
      </Card>

      <Card id="skills" eyebrow="Skills" title="Reusable capability packs">
        <P>
          A skill is a directory at <C>{"~/.claude/agents/_skills/<name>/"}</C> containing
          a <C>SKILL.md</C> file. When an agent lists a skill, the body of that file is
          prepended to every summon.
        </P>
        <H3>Skill file format</H3>
        <CodeBlock lang="markdown" body={`---
name: webapp-testing
description: Browser-based QA using Playwright.
---

## How to test web apps

Use the Playwright MCP server already configured in your environment...`} />

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

        <H3>Skill install provenance</H3>
        {/* src: packages/shared/src/services/paths.ts */}
        <P>
          Every skill installed from the registry includes a <C>.source.json</C> sidecar at{" "}
          <C>{"~/.claude/agents/_skills/<name>/.source.json"}</C>. It records the origin
          for reproducibility and update checks.
        </P>
        {/* src: packages/shared/src/types/index.ts#L14 */}
        <CodeBlock lang="json" body={`{
  "source": "anthropics/skills",
  "ref": "main",
  "path": "browser-automation",
  "sha": "abc123...",
  "installedAt": "2026-05-24T10:00:00.000Z"
}`} />

        <H3>Registry cache</H3>
        {/* src: apps/web/src/app/api/skills/registry — skills.ts#L29 */}
        <P>
          The registry response is cached for 1 hour in{" "}
          <C>{"~/.claude/agents/_skills/_registry.json"}</C>. Pass <C>?refresh=1</C> to{" "}
          <C>GET /api/skills/registry</C> to bypass the cache and fetch fresh data from GitHub.
        </P>

        <H3>Security</H3>
        <P>
          Skills are injected into the system prompt verbatim — there is no sandbox. A third-party
          skill runs with the full tool access configured for the agent. Review skill content before
          installing packs from unknown sources.
        </P>

        <H3>Writing a local skill</H3>
        <CodeBlock lang="bash" body={`mkdir -p ~/.claude/agents/_skills/my-skill
cat > ~/.claude/agents/_skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: What this skill teaches the agent.
---

## Instructions

Everything here is injected into the system prompt.
EOF`} />
        <P>Then reference it in any agent's frontmatter:</P>
        <CodeBlock lang="yaml" body={`skills:
  - my-skill`} />
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
        {/* src: packages/shared/src/services/paths.ts#L13 */}
        <CodeBlock lang="markdown" body={`---
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
- Never commit .env files`} />
        <H3>Roster instance fields</H3>
        {/* src: packages/shared/src/types/index.ts#L95 */}
        <Table
          headers={["Field", "Description"]}
          rows={[
            [<C>instanceId</C>, "Unique ID for this agent in this project. Auto-generated."],
            [<C>agentId</C>, "Base agent filename (without .md)"],
            [<C>label</C>, "Optional display name override"],
            [<C>model</C>, "Overrides the agent's default-model for this project"],
            [<C>effort</C>, "Overrides the agent's default-effort for this project"],
            [<C>permissionMode</C>, "Overrides the agent's permission-mode for this project"],
            [<C>room</C>, "Room on the office floor (inherits from agent if unset)"],
            [<C>cwd</C>, "Absolute path to git worktree (multi-instance). Falls back to project.meta.cwd."],
          ]}
        />
        <H3>Project memory</H3>
        <P>
          The Markdown body of the <C>project.md</C> file (below the closing <C>---</C>
          fence) is the project memory. It is injected into every agent summon for agents rostered
          to this project. Edit it from the UI (<strong>Project → Memory</strong> tab) or directly
          in the file.
        </P>
      </Card>
    </>
  );
}

function MemoryTab() {
  return (
    <>
      <Card id="memory" eyebrow="Memory" title="Persistent context across runs">
        <P>
          Three tiers of persistent memory — all plain Markdown files, editable directly
          in any text editor.
        </P>
        <div className="grid gap-2">
          {[
            { tier: "Global",    path: "~/.claude/agents/_global.memory.md",  desc: "Injected into every agent on every summon." },
            { tier: "Project",   path: "~/.claude/projects/<id>/project.md",  desc: "Injected for all agents assigned to that project (the body below the --- fence)." },
            { tier: "Per-agent", path: "~/.claude/agents/<id>.memory.md",     desc: "Injected only when that specific agent is summoned." },
          ].map((m) => (
            <div key={m.tier} className={`flex gap-3.5 items-start px-[20px] py-[14px] rounded-[8px] border ${B} bg-[var(--bg-2)]`}>
              <div className="font-[var(--font-mono)] text-[8px] font-bold tracking-[0.14em] uppercase text-[var(--acc)] bg-[var(--acc-faint)] px-2 py-[3px] rounded-[4px] flex-shrink-0 mt-0.5">
                {m.tier}
              </div>
              <div>
                <div className="font-[var(--font-mono)] text-[11.5px] text-[var(--txt)] mb-1">{m.path}</div>
                <div className="text-[12px] text-[var(--txt-3)] leading-[1.5]">{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <H3>Example global memory</H3>
        <CodeBlock lang="markdown" body={`# Global memory

User: Alex. Prefers concise explanations. Linux machine.
Always use pnpm, never npm. TypeScript strict mode everywhere.`} />
        <H3>Editing from the UI</H3>
        <P>
          Open any agent's detail panel → <strong>Memory</strong> tab. Changes are saved to
          disk immediately; the next summon picks them up automatically.
        </P>
        <Note kind="tip">
          With <C>Write</C> tool access and <C>bypassPermissions</C> mode, an agent can update
          its own memory file during a run — giving it the ability to remember things across sessions.
        </Note>
        <H3>256 KB limit</H3>
        {/* src: docs/decisions/2026-05-docs-source-map.md — PUT /api/agents/:id/memory */}
        <P>
          The <C>PUT /api/agents/:id/memory</C>, <C>PUT /api/projects/:id/memory</C>, and{" "}
          <C>PUT /api/memory/global</C> endpoints enforce a 256 KB hard cap on memory file size.
          Requests exceeding this limit are rejected with HTTP 413. If you need more context,
          split it across tiers or reference an external file from the memory body.
        </P>
        <H3>Self-modification races</H3>
        <P>
          When an agent updates its own memory mid-run using the <C>Write</C> tool, the new
          content takes effect on the <em>next</em> summon — the current run's appended prompt
          was already assembled at spawn time. Avoid having two parallel instances of the same
          agent write to the same memory file simultaneously; last write wins and earlier content
          is lost.
        </P>
        <H3>Manual git tracking</H3>
        <P>
          Memory files are plain text, making them easy to version with git. Useful recipe for
          tracking changes across sessions:
        </P>
        <CodeBlock lang="bash" body={`cd ~/.claude/agents
git init
git add *.memory.md _global.memory.md
git commit -m "initial memory snapshot"
# later, after sessions:
git add -A && git commit -m "memory update $(date -I)"
git log --oneline *.memory.md`} />
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
            { dot: "bg-[var(--txt-2)]",        pulse: false, label: "done",     textColor: "text-[var(--txt-2)]",        desc: "Last run completed successfully" },
            { dot: "bg-[var(--err)]", pulse: false, label: "error",    textColor: "text-[var(--err)]", desc: "Last run ended with an error" },
            { dot: "bg-[var(--bg-4)]",         pulse: false, label: "idle",     textColor: "text-[var(--txt-4)]",        desc: "No recent activity" },
          ].map((s) => (
            <div key={s.label} className={`flex items-center gap-4 px-4 py-3 rounded-[8px] border ${B} bg-[var(--bg-1)]`}>
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
                <span className={`font-[var(--font-mono)] text-[11px] font-semibold ${s.textColor}`}>{s.label}</span>
              </div>
              <span className="text-[12.5px] text-[var(--txt-3)]">{s.desc}</span>
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
            { title: "Resume", desc: <>Claude Code returns a session ID at the end of each run. The next message passes <C>{"--resume <sessionId>"}</C> so the agent retains full context. If the session has expired the app retries automatically without <C>--resume</C>.</> },
          ]}
        />
        <H3>Aborting a run</H3>
        <P>
          The <strong>Abort</strong> button sends SIGTERM to the <C>claude</C> subprocess via{" "}
          <C>POST /api/runs/:id/abort</C>. Partial output is preserved in SQLite with exit code{" "}
          <C>1</C>. You can resume the conversation from that point.
        </P>
        <H3>Exit codes</H3>
        {/* src: packages/shared/src/services/db.ts#L24 */}
        <Table
          headers={["Exit code", "Meaning"]}
          rows={[
            ["0", "Successful completion"],
            ["1", "Claude CLI error (see output for details)"],
            // src: packages/shared/src/services/runs.ts#L338-L353
            ["130", "Server restart (SIGTERM/SIGINT) — set by killAllRuns()"],
            ["-1", "Server restarted while run was in progress (orphaned run)"],
          ]}
        />
      </Card>

      <Card id="history" eyebrow="Run History" title="Every run, stored forever">
        <P>
          All run data lives in <C>~/.claude/agent-office/db.sqlite</C>. Nothing is sent
          to any server. Back it up, query it directly, or delete it to start fresh.
        </P>
        {/* src: packages/shared/src/services/db.ts#L37 — actual snake_case column names */}
        <Table
          headers={["Column", "Description"]}
          rows={[
            [<C>id</C>, "UUID for the run"],
            [<C>agent_id</C>, "Agent filename (without .md)"],
            [<C>agent_name</C>, "Display name at the time of the run"],
            [<C>instance_id</C>, "Instance within the project roster"],
            [<C>project_id</C>, "Which project the run belongs to"],
            [<C>prompt</C>, "The full user prompt sent"],
            [<C>output</C>, "Full plain-text transcript"],
            [<C>status</C>, "done · error · running"],
            [<C>exit_code</C>, "Subprocess exit code (130 = aborted, -1 = orphaned)"],
            [<C>tokens_in</C>, "Input token count"],
            [<C>tokens_out</C>, "Output token count"],
            [<C>cost_usd</C>, "USD cost reported by the API"],
            [<C>dur_ms</C>, "Wall-clock duration in milliseconds"],
            [<C>session_id</C>, "Claude Code session ID for resumption"],
            [<C>started_at</C>, "Unix ms timestamp when the run started"],
          ]}
        />
        <H3>Querying directly</H3>
        <CodeBlock lang="bash" body={`sqlite3 ~/.claude/agent-office/db.sqlite

-- All runs for the developer agent
SELECT started_at, prompt, status, cost_usd
FROM runs WHERE agent_id = 'developer'
ORDER BY started_at DESC LIMIT 20;

-- Total spend by agent this month
SELECT agent_name, ROUND(SUM(cost_usd), 4) AS total_usd
FROM runs
WHERE started_at > strftime('%s','now','-30 days') * 1000
GROUP BY agent_name ORDER BY total_usd DESC;

-- Token usage breakdown
SELECT agent_name, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(dur_ms)/1000 as secs
FROM runs WHERE status = 'done'
GROUP BY agent_name;`} />
        <H3>Full-text search</H3>
        {/* src: packages/shared/src/services/db.ts#L109 */}
        <P>
          A <C>messages_fts</C> FTS5 virtual table is kept in sync with the <C>messages</C> table
          via triggers. The in-app search bar (Cmd+K) queries this table. You can also use it
          directly:
        </P>
        <CodeBlock lang="bash" body={`-- Full-text search across all messages
SELECT m.run_id, m.content
FROM messages m
JOIN messages_fts fts ON m.rowid = fts.rowid
WHERE messages_fts MATCH 'TypeScript migration'
ORDER BY m.ts DESC LIMIT 20;`} />
        <Note kind="info">
          Agents are told the SQLite path in every system prompt. An agent with <C>Bash</C> access
          can query its own past runs to recall what it has done across sessions.
        </Note>
      </Card>

      {/* src: packages/shared/src/services/pipeline.ts */}
      <Card id="pipelines" eyebrow="Pipelines" title="Multi-step agent chains">
        <P>
          A pipeline chains multiple agent runs together. Each step receives the previous step's
          output via the <C>{"{{output}}"}</C> substitution token. Steps within a parallel group
          run concurrently; their outputs are joined before the next sequential step.
        </P>
        <H3>Step types</H3>
        {/* src: packages/shared/src/types/index.ts#L198 */}
        <Table
          headers={["Type", "TypeScript interface", "Behaviour"]}
          rows={[
            ["Sequential", <C>PipelineStep</C>, "Runs after the previous step completes. Receives prior output."],
            ["Parallel group", <C>ParallelPipelineStep</C>, "All steps within the group run concurrently. Their outputs are joined with \\n\\n---\\n\\n for the next step."],
          ]}
        />
        <H3>Timeouts</H3>
        {/* src: packages/shared/src/services/pipeline.ts#L36 */}
        <P>
          Each individual step times out after <strong>10 minutes</strong> (<C>STEP_TIMEOUT_MS</C>).
          The entire pipeline has a hard cap of <strong>30 minutes</strong> (<C>PIPELINE_TIMEOUT_MS</C>).
          When either limit is hit, all remaining steps are marked as <C>error</C>.
        </P>
        <H3>Recovery on restart</H3>
        {/* src: packages/shared/src/services/db.ts#L24 */}
        <P>
          On server restart, any pipeline with <C>status = 'running'</C> is set to{" "}
          <C>status = 'error', interrupted = 1</C>. The UI shows a recovery banner for interrupted
          pipelines so you can inspect which steps completed before the restart.
        </P>
        <H3>API</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["POST", "/api/pipeline", "Create and start a pipeline. Returns 202 with { pipelineId, steps }."],
            ["GET", "/api/pipeline/:id", "Poll pipeline status. Returns PipelineRun with per-step state."],
          ]}
        />
        <H3>Example: 3-step pipeline with a parallel group</H3>
        {/* src: packages/shared/src/types/index.ts#L213 */}
        <CodeBlock lang="json" body={`{
  "projectId": "my-project",
  "steps": [
    {
      "agentId": "researcher",
      "promptTemplate": "Research the topic: {{output}}"
    },
    {
      "kind": "parallel",
      "steps": [
        {
          "agentId": "writer-en",
          "promptTemplate": "Write an English summary: {{output}}"
        },
        {
          "agentId": "writer-fr",
          "promptTemplate": "Write a French summary: {{output}}"
        }
      ]
    },
    {
      "agentId": "publisher",
      "promptTemplate": "Publish both summaries: {{output}}"
    }
  ]
}`} />
        <Note kind="info">
          The first step's <C>{"{{output}}"}</C> expands to an empty string. Use it from step 2
          onward to chain outputs. The parallel group's two outputs are joined with a separator
          before being passed to the publisher step.
        </Note>
      </Card>

      {/* src: packages/shared/src/services/worktrees.ts, docs/decisions/2026-05-multi-instance.md */}
      <Card id="multi-instance" eyebrow="Multi-instance" title="Multi-instance & Worktrees">
        <P>
          You can add the same agent to a project multiple times as separate instances.
          Each instance beyond the first gets its own git worktree for complete filesystem
          isolation — no cross-instance file collisions.
        </P>
        <H3>Worktree isolation model</H3>
        {/* src: packages/shared/src/services/worktrees.ts#L22 */}
        <P>
          When a new instance is created for a git project, Agent Office runs{" "}
          <C>git worktree add</C> to create an isolated working tree at:
        </P>
        <CodeBlock lang="text" body={`<projectCwd>/.worktrees/<instanceId>/`} />
        {/* src: packages/shared/src/services/worktrees.ts#L31 */}
        <P>
          The worktree is placed on a fresh branch named <C>{"agent/<instanceId>-<timestamp>"}</C>.
          The timestamp suffix prevents conflicts if an instance is terminated and re-created.
        </P>
        <H3>Instance caps</H3>
        {/* src: docs/decisions/2026-05-multi-instance.md */}
        <Table
          headers={["Cap", "Value", "Response"]}
          rows={[
            ["Soft cap", "5 per agent per project", "409 INSTANCE_CAP_EXCEEDED with { softCap: true } — UI shows a confirmation dialog; user can override."],
            ["Hard cap", "10 per agent per project", "409 INSTANCE_CAP_EXCEEDED with { softCap: false } — UI shows an error toast; cannot be overridden."],
          ]}
        />
        <H3>Non-git fallback</H3>
        <P>
          If the project directory is not a git repository, no worktree is created. All instances
          share the project root <C>cwd</C>. A warning toast is shown on spawn. The{" "}
          <C>instance.cwd</C> field is <C>undefined</C> and falls back to <C>project.meta.cwd</C>.
        </P>
        <H3>Lifecycle</H3>
        <Flow
          steps={[
            { title: "Spawn", desc: <>POST /api/projects/:id/roster creates the instance, runs git worktree add, records <C>instance.worktree</C> in project.md.</> },
            { title: "Use", desc: "Each summon for this instance uses the worktree path as cwd. The agent works in complete isolation from other instances." },
            { title: "Terminate", desc: <>DELETE /api/projects/:id/roster/:instanceId calls git worktree remove --force then deletes the branch. SQLite rows (runs, messages) are kept — they are archived, not deleted.</> },
          ]}
        />
        <H3>Boot reconciliation</H3>
        {/* src: docs/decisions/2026-05-multi-instance.md#L76 */}
        <P>
          On app startup the server scans <C>{"<projectCwd>/.worktrees/"}</C> for each known project.
          Any directory with no matching <C>instanceId</C> in the roster is an orphan (caused by a
          crash mid-spawn) and is removed via <C>git worktree remove --force</C>.
        </P>
        <Note kind="info">
          Multi-instance support is controlled by the <C>features.multiInstance</C> flag in{" "}
          <C>~/.claude/agent-office-settings.json</C>. It defaults to <C>false</C>.
          The first instance of any agent is always unaffected regardless of the flag value.
        </Note>
      </Card>

      {/* src: apps/web/src/lib/claude-limits.ts */}
      <Card id="spend-limits" eyebrow="Spend Limits" title="Spend Limits & Quota">
        <P>
          Agent Office can enforce a USD spending quota per period and optionally block or warn
          when the quota is reached. Configure in <strong>Settings → Limits</strong>.
        </P>
        <H3>Period options</H3>
        {/* src: apps/web/src/lib/claude-limits.ts#L1 */}
        <Table
          headers={["Period", "Value", "Behaviour"]}
          rows={[
            ["Daily", <C>daily</C>, "Resets at midnight local time"],
            ["Weekly", <C>week</C>, "Resets on Monday at midnight (ISO week, default)"],
            ["Monthly", <C>month</C>, "Resets on the 1st of each month at midnight"],
          ]}
        />
        <H3>Hard cap modes</H3>
        {/* src: apps/web/src/lib/claude-limits.ts#L2 */}
        <Table
          headers={["Mode", "Behaviour"]}
          rows={[
            [<C>off</C>, "No quota enforcement — runs always proceed"],
            [<C>warn</C>, "A warning banner is shown when quota is reached but runs still proceed (default)"],
            [<C>block</C>, "New runs return HTTP 402 quota_exceeded when the quota is exceeded"],
          ]}
        />
        <H3>Quota exceeded error</H3>
        <P>
          When <C>hardCap: block</C> is set and the period quota is exhausted, <C>POST /api/summon</C>{" "}
          returns HTTP 402 with:
        </P>
        {/* src: apps/web/src/app/api/summon/route.ts#L32-L39 */}
        <CodeBlock lang="json" body={`{ "error": "quota_exceeded", "detail": "Weekly spend cap of $4.00 reached" }`} />
        <H3>Per-run spend cap</H3>
        {/* src: packages/shared/src/services/summon.ts#L38 */}
        <P>
          Separate from the period quota, you can set a per-run USD cap via the <C>maxBudgetUsd</C>{" "}
          field in the summon request body or the agent summon dialog. This maps to the{" "}
          <C>--max-budget-usd</C> CLI flag and is enforced by Claude Code directly.
        </P>
        <H3>Default limits</H3>
        {/* src: apps/web/src/lib/claude-limits.ts#L10 */}
        <CodeBlock lang="json" body={`{ "quotaUsd": 0, "period": "week", "hardCap": "warn" }`} />
        <P>A <C>quotaUsd</C> of <C>0</C> means no quota is set. The defaults shown above are applied when the limit setting has never been configured.</P>
      </Card>

      <Card id="processes" eyebrow="Processes" title="Processes Panel">
        <P>
          The Processes panel shows all user-owned processes that are listening on a port on the
          local machine. It is primarily useful for monitoring dev servers and Docker containers
          that agents have launched.
        </P>
        <H3>Accessing the panel</H3>
        <P>
          Open it from the sidebar icon or via the project detail view. It is Linux-only
          and reads <C>/proc/&lt;pid&gt;/</C> files to enumerate listening processes.
        </P>
        <H3>Log tailing</H3>
        {/* src: docs/decisions/2026-05-docs-source-map.md — GET /api/processes/:pid/logs */}
        <P>
          For processes launched by Agent Office (via the dev server or build runner), stdout and
          stderr are captured. Retrieve them with:
        </P>
        <CodeBlock lang="bash" body={`GET /api/processes/:pid/logs
# Response: { lines: string[], exitCode: number | null, signal: string | null, found: boolean }`} />
        <H3>Lifecycle</H3>
        <Table
          headers={["Action", "API", "Behaviour"]}
          rows={[
            ["List", "GET /api/processes", "Returns ProcessInfo[] for all listening ports owned by the current user"],
            ["Check liveness", "GET /api/processes/:pid", "Returns { alive: boolean }"],
            ["Kill", "DELETE /api/processes/:pid", "Sends SIGKILL to the process"],
          ]}
        />
        <Note kind="warn">
          Processes started outside Agent Office (e.g. in a separate terminal) are listed for
          visibility only. Their stdio is not captured, so log tailing returns <C>found: false</C>.
        </Note>
      </Card>
    </>
  );
}

function ReferenceTab() {
  return (
    <>
      <Card id="storage" eyebrow="Data & Storage" title="What lives where on disk">
        {/* src: packages/shared/src/services/paths.ts */}
        <CodeBlock lang="bash" body={`~/.claude/
├── agents/
│   ├── <id>.md                   # Agent definition + system prompt
│   ├── <id>.memory.md            # Per-agent memory
│   ├── <id>.body.<ISO>.md        # Body backup snapshots (max 10)
│   ├── _global.memory.md         # Global memory (all agents)
│   └── _skills/
│       ├── <skill-name>/
│       │   ├── SKILL.md
│       │   └── .source.json      # Install provenance (sha, source, ref)
│       └── _registry.json        # Registry cache (1hr TTL)
│
├── projects/
│   └── <project-id>/
│       ├── project.md            # Roster + project memory
│       └── _uploads/             # Per-project file attachments
│
├── agent-office/
│   └── db.sqlite                 # All runs, messages, transcripts, pipelines
│
├── .credentials.json             # Claude auth (plan detection)
└── agent-office-settings.json    # projectsRoot, excluded, firstRunComplete`} />
        <H3>Backup</H3>
        <CodeBlock lang="bash" body={`sqlite3 ~/.claude/agent-office/db.sqlite \\
  ".backup ~/.claude/agent-office/db.sqlite.bak"`} />
      </Card>

      {/* src: apps/web/src/app/api/save/export/route.ts */}
      <Card id="save-export" eyebrow="Save / Export" title="Save / Export / Import">
        <P>
          Agent Office can export a project as a self-contained JSON file. This captures
          everything needed to restore the project on another machine — minus the SQLite run
          history, which stays local.
        </P>
        <H3>What gets exported</H3>
        {/* src: apps/web/src/app/api/save/export/route.ts#L61 */}
        <Table
          headers={["Included", "Details"]}
          rows={[
            ["Project metadata", "id, meta (name, description, cwd, roster), memory body"],
            ["Agent definitions", "Full .md file content + per-agent memory for each rostered agent (deduplicated)"],
            ["Office settings", "Grid layout, decorations, agent positions, grass colour from ui_settings"],
            ["Conversation history", "Optional — pass ?history=1 to include transcripts for all roster instances"],
          ]}
        />
        <H3>What is NOT exported</H3>
        <P>
          The SQLite database (<C>db.sqlite</C>) is not included. Run records, token usage, and
          cost history stay on the originating machine.
        </P>
        <H3>Export</H3>
        <CodeBlock lang="bash" body={`GET /api/save/export?projectId=<id>
GET /api/save/export?projectId=<id>&history=1   # include transcripts

# Response: JSON attachment named "<project-slug>-agent-office.json"`} />
        <H3>Import / restore</H3>
        <CodeBlock lang="bash" body={`POST /api/save/import
Content-Type: application/json
<save file body>

# Response: { ok: true, agentCount: 3 }`} />
        <H3>Cross-machine migration</H3>
        <Flow
          steps={[
            { title: "Export on source machine", desc: <>GET /api/save/export?projectId=&lt;id&gt;&history=1 — save the JSON file.</> },
            { title: "Copy to destination", desc: "Transfer the JSON file to the target machine (scp, USB, cloud storage)." },
            { title: "Import on destination", desc: <>POST /api/save/import — agents, project metadata, memory files, and office layout are restored. Run the first-run wizard first if it is a fresh install.</> },
          ]}
        />
      </Card>

      {/* src: apps/web/src/app/api/ */}
      <Card id="rest-api" eyebrow="REST API" title="REST API Reference">
        <P>
          All routes are served by the Next.js backend embedded in the Tauri shell.
          Base URL is <C>http://localhost:&lt;port&gt;</C>. All request/response bodies are JSON
          unless noted otherwise.
        </P>
        {/* src: docs/decisions/2026-05-docs-source-map.md — section 1 */}
        <H3>Agents</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/agents", "List all agent definitions"],
            ["POST", "/api/agents", "Create agent (body: agentBodySchema)"],
            ["POST", "/api/agents/bulk", "Bulk-create agents"],
            ["GET", "/api/agents/:id", "Get agent frontmatter"],
            ["PUT", "/api/agents/:id", "Update agent (backs up body first)"],
            ["DELETE", "/api/agents/:id", "Delete agent file + memory sidecar"],
            ["GET", "/api/agents/:id/body", "Raw markdown body (text/plain)"],
            ["PUT", "/api/agents/:id/body", "Replace body; backs up to <id>.body.<ISO>.md"],
            ["GET", "/api/agents/:id/body/history", "List body backup snapshots"],
            ["GET", "/api/agents/:id/body/history/:filename", "Read one snapshot"],
            ["GET", "/api/agents/:id/memory", "Per-agent memory file"],
            ["PUT", "/api/agents/:id/memory", "Write per-agent memory (max 256 KB)"],
            ["GET", "/api/agents/:id/prompts", "Recent prompts for agent"],
            ["POST", "/api/agents/:id/prompts", "Push a recent prompt"],
            ["GET", "/api/agents/:id/uploads", "List agent uploads"],
            ["POST", "/api/agents/:id/uploads", "Upload file (multipart/form-data)"],
            ["GET", "/api/agents/:id/uploads/:filename", "Download agent upload"],
          ]}
        />
        <H3>Memory</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/memory/global", "Read global memory file"],
            ["PUT", "/api/memory/global", "Write global memory (max 256 KB)"],
          ]}
        />
        <H3>Runs</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["POST", "/api/summon", "Spawn claude subprocess for one agent"],
            ["GET", "/api/runs", "List runs (?agent=&project=&instance=&limit=)"],
            ["DELETE", "/api/runs", "Delete all runs for an agent (?agent=)"],
            ["GET", "/api/runs/:id", "Get single run"],
            ["GET", "/api/runs/:id/stream", "SSE stream — live or replay finished"],
            ["POST", "/api/runs/:id/abort", "SIGKILL the claude subprocess"],
          ]}
        />
        <H3>Projects</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/projects", "List project summaries"],
            ["POST", "/api/projects", "Create project"],
            ["GET", "/api/projects/:id", "Get project + run stats"],
            ["PUT", "/api/projects/:id", "Update project metadata"],
            ["DELETE", "/api/projects/:id", "Delete project"],
            ["GET", "/api/projects/:id/memory", "Project memory"],
            ["PUT", "/api/projects/:id/memory", "Write project memory (max 256 KB)"],
            ["POST", "/api/projects/:id/roster", "Add agent instance"],
            ["GET", "/api/projects/:id/roster/:instanceId", "Get instance + USD spend"],
            ["PATCH", "/api/projects/:id/roster/:instanceId", "Update instance settings"],
            ["DELETE", "/api/projects/:id/roster/:instanceId", "Remove instance (cleans worktree)"],
            ["GET", "/api/projects/:id/spend", "USD spend breakdown by instance"],
            ["GET", "/api/projects/:id/git-status", "Git branch/diff/ahead/behind"],
            ["POST", "/api/projects/:id/dev", "Spawn dev server in terminal"],
            ["POST", "/api/projects/:id/build", "Run build script in terminal"],
            ["POST", "/api/projects/:id/install", "Run package manager install"],
            ["POST", "/api/projects/:id/open-folder", "xdg-open project directory"],
            ["GET", "/api/projects/:id/uploads", "List project uploads"],
            ["POST", "/api/projects/:id/uploads", "Upload file for project"],
          ]}
        />
        <H3>Pipelines & Broadcast</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["POST", "/api/pipeline", "Create & start multi-agent pipeline (202)"],
            ["GET", "/api/pipeline/:id", "Poll pipeline status"],
            ["POST", "/api/broadcast", "Fan-out prompt to all roster instances (202)"],
          ]}
        />
        <H3>Processes</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/processes", "List user's listening ports (Linux only)"],
            ["GET", "/api/processes/:pid", "Check process liveness"],
            ["DELETE", "/api/processes/:pid", "SIGKILL process"],
            ["GET", "/api/processes/:pid/logs", "Captured stdout/stderr"],
          ]}
        />
        <H3>Settings</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/settings", "Read app settings"],
            ["PUT", "/api/settings", "Write app settings"],
            ["GET", "/api/settings/scan", "Scan filesystem for projects (?root=&excluded=)"],
            ["GET", "/api/ui-settings", "All UI settings from SQLite"],
            ["PATCH", "/api/ui-settings", "Write allowed UI settings"],
          ]}
        />
        <H3>Skills</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/skills/installed", "List installed skills"],
            ["POST", "/api/skills/install", "Install skill from GitHub"],
            ["GET", "/api/skills/registry", "Fetch skill registry (?refresh=1 to bypass cache)"],
            ["GET", "/api/skills/updates", "Check installed skills for updates"],
            ["GET", "/api/skills/:name", "Get single installed skill"],
            ["DELETE", "/api/skills/:name", "Uninstall skill"],
            ["POST", "/api/skills/:name/update", "Update skill to latest SHA"],
          ]}
        />
        <H3>Save / Import-Export</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/save/export", "Export project save file (?projectId=&history=1)"],
            ["POST", "/api/save/import", "Import project save file"],
            ["GET", "/api/starter/agents", "List bundled starter agents"],
            ["POST", "/api/starter/agents", "Import selected starter agents"],
            ["GET", "/api/templates", "List agent creation templates"],
          ]}
        />
        <H3>System</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET", "/api/health", "Claude CLI availability check (?force=1 to bypass cache)"],
            ["GET", "/api/account", "Read plan from ~/.claude/.credentials.json"],
            ["POST", "/api/clipboard-image", "Read clipboard PNG via wl-paste (Wayland only)"],
          ]}
        />
      </Card>

      {/* src: packages/shared/src/types/index.ts#L173, packages/shared/src/services/runs.ts */}
      <Card id="sse-events" eyebrow="SSE Events" title="SSE Event Reference">
        <P>
          All events are delivered over <C>GET /api/runs/:id/stream</C> using the SSE wire format:
        </P>
        <CodeBlock lang="text" body={`event: <name>
data: <json>

`} />
        {/* src: docs/decisions/2026-05-docs-source-map.md — section 2 */}
        <Table
          headers={["Event", "Payload fields", "Emitted at"]}
          rows={[
            [<C>attached</C>, "runId, output, tokensIn, tokensOut, cost, status, startTs", "Immediately on subscribe — delivers current run state"],
            [<C>chunk</C>, "runId, text", "Each text delta and completed assistant block"],
            [<C>tool</C>, "runId, name, input?", "Each tool_use content block start"],
            [<C>usage</C>, "runId, tokensIn, tokensOut, cost", "Per-message usage update and final result event"],
            [<C>done</C>, "runId, exitCode, sessionId?, durationMs?, tokensIn?, tokensOut?, cost?", "Process exit — run finalised in SQLite"],
            [<C>error</C>, "runId, message", "Spawn error, rate limit, or is_error result"],
          ]}
        />
        <H3>Replay behaviour</H3>
        {/* src: packages/shared/src/services/runs.ts#L57 */}
        <P>
          Events <C>chunk</C>, <C>tool</C>, and <C>usage</C> are stored in an in-memory{" "}
          <C>eventLog</C> and replayed to late subscribers. <C>done</C> and <C>error</C> are
          not stored in the eventLog — if you connect after a run finishes, <C>attached</C>{" "}
          delivers the final state and <C>done</C> is synthesised from the persisted record.
        </P>
        <H3>Keepalive</H3>
        {/* src: apps/web/src/app/api/runs/[id]/stream/route.ts#L9 */}
        <P>
          The SSE route sends <C>{`: keepalive`}</C> every 25 seconds to prevent proxy timeouts.
        </P>
        <H3>Wire format examples</H3>
        <CodeBlock lang="text" body={`event: attached
data: {"runId":"abc","output":"","tokensIn":0,"tokensOut":0,"cost":0,"status":"running","startTs":1716800000000}

event: chunk
data: {"runId":"abc","text":"Here is the analysis..."}

event: tool
data: {"runId":"abc","name":"Read","input":{"file_path":"/src/index.ts"}}

event: usage
data: {"runId":"abc","tokensIn":1240,"tokensOut":380,"cost":0.0042}

event: done
data: {"runId":"abc","exitCode":0,"sessionId":"sess_xyz","durationMs":4200,"tokensIn":1240,"tokensOut":380,"cost":0.0042}`} />
      </Card>

      {/* src: packages/shared/src/services/db.ts */}
      <Card id="db-schema" eyebrow="Database" title="Database Schema">
        <P>
          SQLite database at <C>~/.claude/agent-office/db.sqlite</C>. All column names are
          snake_case. WAL mode is enabled for concurrent reads.
        </P>
        <H3>Pragmas</H3>
        {/* src: packages/shared/src/services/db.ts#L17 */}
        <CodeBlock lang="sql" body={`PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;`} />
        <H3>runs</H3>
        {/* src: packages/shared/src/services/db.ts#L37 */}
        <CodeBlock lang="sql" body={`CREATE TABLE runs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT,
  agent_name    TEXT,
  instance_id   TEXT DEFAULT 'default',
  instance_label TEXT,
  project_id    TEXT,
  session_id    TEXT,
  status        TEXT DEFAULT 'running',
  exit_code     INTEGER,
  prompt        TEXT,
  output        TEXT DEFAULT '',
  tokens_in     INTEGER DEFAULT 0,
  tokens_out    INTEGER DEFAULT 0,
  cost_usd      REAL DEFAULT 0,
  dur_ms        INTEGER,
  model         TEXT DEFAULT '',
  effort        TEXT DEFAULT '',
  cwd           TEXT,
  started_at    INTEGER,
  ended_at      INTEGER
);`} />
        <H3>messages</H3>
        {/* src: packages/shared/src/services/db.ts (messages table) */}
        <CodeBlock lang="sql" body={`CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  run_id      TEXT REFERENCES runs(id),
  agent_id    TEXT,
  instance_id TEXT DEFAULT 'default',
  role        TEXT CHECK(role IN ('user','assistant')),
  content     TEXT,
  ts          INTEGER
);
-- Truncated at insert: user<=2000 chars, assistant<=8000`} />
        <H3>pipelines & pipeline_steps</H3>
        {/* src: packages/shared/src/services/db.ts#L136 */}
        <CodeBlock lang="sql" body={`CREATE TABLE pipelines (
  id           TEXT PRIMARY KEY,
  project_id   TEXT,
  status       TEXT DEFAULT 'running',
  created_at   INTEGER,
  ended_at     INTEGER,
  interrupted  INTEGER DEFAULT 0
);

CREATE TABLE pipeline_steps (
  pipeline_id    TEXT REFERENCES pipelines(id),
  step_index     INTEGER,
  parallel_group INTEGER,
  agent_id       TEXT,
  run_id         TEXT,
  status         TEXT DEFAULT 'pending',
  output         TEXT,
  exit_code      INTEGER,
  PRIMARY KEY (pipeline_id, step_index)
);`} />
        <H3>Other tables</H3>
        <Table
          headers={["Table", "Purpose"]}
          rows={[
            [<C>tool_calls</C>, "id, run_id, name, input, ts — best-effort insert per tool invocation"],
            [<C>recent_prompts</C>, "Per-agent prompt history, max 10 per agent (AUTOINCREMENT PK)"],
            [<C>transcripts</C>, "agent_id + instance_id PK, stores JSON items array + active_run_id"],
            [<C>drafts</C>, "agent_id + instance_id PK, persists composer draft text"],
            [<C>ui_settings</C>, "key/value store for office layout and other UI state; internal keys prefixed _"],
          ]}
        />
        <H3>Virtual table</H3>
        {/* src: packages/shared/src/services/db.ts#L109-L111 */}
        <CodeBlock lang="sql" body={`CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content, content=messages, content_rowid=rowid
);
-- Kept in sync via INSERT/UPDATE/DELETE triggers on messages`} />
        <H3>Migrations</H3>
        {/* src: packages/shared/src/services/db.ts#L169 */}
        <P>
          Schema version is tracked with <C>PRAGMA user_version</C>. Three migrations run at
          startup: v0→v1 (initial schema + indexes), v1→v2 (pipelines tables), v2→v3 (started_at index).
        </P>
        <H3>Crash recovery</H3>
        {/* src: packages/shared/src/services/db.ts#L24 */}
        <P>
          On open, all <C>status='running'</C> runs are set to <C>status='error', exit_code=-1</C>
          and all <C>status='running'</C> pipelines are set to <C>status='error', interrupted=1</C>.
        </P>
        <H3>Direct queries</H3>
        <CodeBlock lang="bash" body={`sqlite3 ~/.claude/agent-office/db.sqlite

-- Runs for a specific agent, newest first
SELECT id, started_at, status, exit_code, cost_usd, dur_ms
FROM runs WHERE agent_id = 'developer'
ORDER BY started_at DESC LIMIT 10;

-- Total cost by agent (all time)
SELECT agent_name, ROUND(SUM(cost_usd), 4) AS total_usd
FROM runs GROUP BY agent_name ORDER BY total_usd DESC;

-- All tool calls for a run
SELECT name, input FROM tool_calls WHERE run_id = 'run-uuid-here';

-- Recent messages for an agent+instance
SELECT role, content, ts FROM messages
WHERE agent_id = 'developer' AND instance_id = 'default'
ORDER BY ts DESC LIMIT 20;

-- Full-text search across all messages
SELECT m.run_id, m.content
FROM messages m
JOIN messages_fts ON m.rowid = messages_fts.rowid
WHERE messages_fts MATCH 'database migration'
LIMIT 20;`} />
      </Card>

      <Card id="build-run" eyebrow="Architecture" title="Build & Run">
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
        {/* src: packages/shared/src/services/agents.ts#L147, packages/shared/src/services/summon.ts */}
        <CodeBlock lang="text" body={`POST /api/summon
  │
  ├─ buildAppendedPrompt()
  │    Skills → Global → Project context → Project memory
  │    → Agent memory → History note (omitted in plan mode)
  │
  ├─ spawn: claude -p --agent <id> --output-format stream-json
  │         --include-partial-messages --verbose
  │         [--model <m>] [--effort <e>] [--max-budget-usd <n>]
  │         [--permission-mode <mode>]
  │         [--add-dir <dir>] ...
  │         [--append-system-prompt <text>]
  │         [--resume <sessionId>]
  │         <prompt>
  │
  ├─ stdout parsed as NDJSON
  │    text chunk   → SSE "chunk"
  │    tool_use     → SSE "tool"
  │    usage        → SSE "usage"
  │
  ├─ Browser: GET /api/runs/<id>/stream  (SSE)
  │    Late joiners replay from in-memory event log
  │
  └─ On exit → write run record to SQLite → SSE "done"`} />
        <H3>Claude CLI flags</H3>
        {/* src: packages/shared/src/services/summon.ts#L13 */}
        <Table
          headers={["Position", "Flag / Value", "Condition"]}
          rows={[
            ["0", "-p", "always"],
            ["1", "--agent", "always"],
            ["2", "<agentId>", "always"],
            ["3", "--output-format", "always"],
            ["4", "stream-json", "always"],
            ["5", "--include-partial-messages", "always"],
            ["6", "--verbose", "always"],
            ["opt", "--model <model>", "omitted if value is \"default\""],
            ["opt", "--effort <effort>", "omitted if value is \"default\""],
            ["opt", "--max-budget-usd <n>", "omitted if value is 0 or unset"],
            ["opt", "--permission-mode <mode>", "from instance or agent frontmatter"],
            ["per dir", "--add-dir <dir>", "one flag per entry in agent.addDirs[], tilde-expanded"],
            ["opt", "--append-system-prompt <text>", "assembled by buildAppendedPrompt()"],
            ["opt", "--resume <sessionId>", "from request.resumeSessionId"],
            ["last", "<prompt>", "priorContext + request.prompt, or just request.prompt"],
          ]}
        />
        <H3>Environment variables</H3>
        {/* src: docs/decisions/2026-05-docs-source-map.md — section 5 */}
        <Table
          headers={["Variable", "Required", "Default", "What it controls"]}
          rows={[
            [<C>ANTHROPIC_API_KEY</C>, "Yes", "none", "API key — inherited by every claude subprocess"],
            [<C>AGENT_OFFICE_STARTER_DATA</C>, "No", "<cwd>/starter-data", "Override path to bundled starter-data directory"],
            [<C>NEXT_PUBLIC_POLL_RUNS</C>, "No", "5000", "Polling interval (ms) for run list"],
            [<C>NEXT_PUBLIC_POLL_HEALTH</C>, "No", "30000", "Polling interval (ms) for health check"],
            [<C>NEXT_PUBLIC_POLL_SKILLS_UPDATES</C>, "No", "60000", "Polling interval (ms) for skills update check"],
            [<C>DEFAULT_LOCALE</C>, "No", "en", "i18n locale override"],
            [<C>NODE_ENV</C>, "No", "production", "Set to development to enable React Query Devtools"],
            [<C>PORT</C>, "No", "dynamic", "Injected into terminal env when launching dev server"],
          ]}
        />
        <H3>PATH augmentation</H3>
        {/* src: packages/shared/src/services/paths.ts#L77 */}
        <P>
          When Tauri launches the app from a desktop shortcut it inherits a minimal environment —
          no <C>.bashrc</C>, no NVM. Before spawning any subprocess Agent Office calls{" "}
          <C>buildAugmentedPath()</C> which prepends:
        </P>
        <CodeBlock lang="text" body={`1. All Node.js bin dirs found under ~/.nvm/versions/node/ (newest first)
2. ~/.local/bin
3. /usr/local/bin
4. /usr/bin
5. /bin`} />
        <H3>Dev mode</H3>
        <CodeBlock lang="bash" body={`# Start the Next.js dev server (port 3000 by default)
pnpm dev

# To run Tauri alongside (separate terminal):
pnpm tauri dev`} />
        <H3>--resume retry behaviour</H3>
        {/* src: packages/shared/src/services/runs.ts#L243-L268 */}
        <P>
          When a run has an existing session ID, Agent Office passes{' '}
          <C>--resume &lt;sessionId&gt;</C> to the Claude CLI to continue the conversation.
          If the session ID is stale — the CLI exits with code&nbsp;1 and stderr contains{' '}
          <C>No conversation found with session ID</C> — Agent Office automatically retries
          the spawn <strong>without</strong> <C>--resume</C>, dropping both the flag and its
          value from the argument list. The retry starts a fresh session while preserving the
          agent, project, and all other spawn arguments.
        </P>
      </Card>

      <Card id="other-features" eyebrow="Other Features" title="Other Features">
        <H3>Full-text search</H3>
        {/* src: packages/shared/src/services/db.ts#L109 */}
        <P>
          Press <strong>Cmd+K</strong> or use the search bar to run full-text queries across all
          stored messages. Powered by the <C>messages_fts</C> FTS5 virtual table, which is kept
          in sync with the <C>messages</C> table via database triggers.
        </P>

        <H3>Agent body history snapshots</H3>
        {/* src: apps/web/src/app/api/agents/[id]/body/history/route.ts */}
        <P>
          Every time an agent's body is updated via <C>PUT /api/agents/:id/body</C>, the previous
          body is backed up to <C>{"~/.claude/agents/<id>.body.<ISO>.md"}</C> (max 10 backups).
          List snapshots with <C>GET /api/agents/:id/body/history</C>, read one with{" "}
          <C>GET /api/agents/:id/body/history/:filename</C>.
        </P>

        <H3>Uploads</H3>
        {/* src: apps/web/src/app/api/agents/[id]/uploads/route.ts */}
        <P>
          File attachments can be uploaded per-agent (<C>POST /api/agents/:id/uploads</C>) or
          per-project (<C>POST /api/projects/:id/uploads</C>). Files are stored in{" "}
          <C>{"~/.claude/agents/_uploads/<agentId>/"}</C> and{" "}
          <C>{"~/.claude/projects/<id>/_uploads/"}</C> respectively. Use <C>multipart/form-data</C>.
        </P>

        <H3>Clipboard image paste</H3>
        {/* src: apps/web/src/app/api/clipboard-image/route.ts */}
        <P>
          On Wayland, <C>POST /api/clipboard-image</C> reads the clipboard PNG via{" "}
          <C>wl-paste</C> and returns it as <C>image/png</C>. Paste screenshots directly into
          the composer to include them in the agent prompt.
        </P>

        <H3>Templates</H3>
        {/* src: apps/web/src/app/api/templates/route.ts */}
        <P>
          <C>GET /api/templates</C> returns a list of <C>AgentTemplate</C> objects used to
          pre-fill the new-agent form with common configurations (researcher, developer, QA, etc.).
        </P>

        <H3>Starter agents</H3>
        {/* src: apps/web/src/app/api/starter/agents/route.ts */}
        <P>
          The bundled starter-data catalogue is accessible at <C>GET /api/starter/agents</C>.
          Import selected agents with <C>POST /api/starter/agents</C> passing{" "}
          <C>{"{ agentIds: string[] }"}</C>. The wizard uses this on first run; you can also
          import additional starters later from the Agents panel.
        </P>

        <H3>Broadcast</H3>
        {/* src: apps/web/src/app/api/broadcast/route.ts */}
        <P>
          <C>POST /api/broadcast</C> fans out a single prompt to every agent instance currently
          rostered to a project. Useful for announcing a task to all agents simultaneously.
          Returns <C>{"{ broadcastId, runIds }"}</C> (202 Accepted). Each run streams independently.
        </P>
        <CodeBlock lang="json" body={`// POST /api/broadcast
{
  "projectId": "my-project",
  "prompt": "The API contract changed. Update your tests.",
  "model": "claude-sonnet-4-5",
  "effort": "medium"
}`} />

        <H3>Dev server launcher</H3>
        {/* src: apps/web/src/app/api/projects/[id]/dev/route.ts */}
        <P>
          <C>POST /api/projects/:id/dev</C> detects available package managers and dev commands
          from the project directory (and from <C>.ao.json</C> if present), spawns the dev server
          in a terminal window, and returns <C>{"{ key, port, url, pid }"}</C>.
        </P>

        <H3>Build runner</H3>
        {/* src: apps/web/src/app/api/projects/[id]/build/route.ts */}
        <P>
          <C>POST /api/projects/:id/build</C> runs the build script for the project in a terminal
          window. Returns <C>{"{ pid }"}</C>. Check completion with{" "}
          <C>GET /api/processes/:pid</C>. Override the detected command with{" "}
          <C>{"{ \"build\": \"...\", \"dev\": \"...\" }"}</C> in a <C>.ao.json</C> file at the
          project root.
        </P>

        <H3>Git status widget</H3>
        {/* src: apps/web/src/app/api/projects/[id]/git-status/route.ts */}
        <P>
          <C>GET /api/projects/:id/git-status</C> returns a <C>GitStatus</C> object with the
          current branch name, number of modified files, and ahead/behind commit counts relative
          to the upstream. Displayed in the project detail panel header.
        </P>

        <H3>Health endpoint</H3>
        {/* src: apps/web/src/app/api/health/route.ts */}
        <P>
          <C>GET /api/health</C> checks whether the <C>claude</C> CLI is available on PATH.
          Returns <C>{"{ available, version, error? }"}</C>. Pass <C>?force=1</C> to bypass the
          30-second cache. The first-run wizard polls this every 5 seconds until the CLI is found.
        </P>

        <H3>Account / plan detection</H3>
        {/* src: apps/web/src/app/api/account/route.ts */}
        <P>
          <C>GET /api/account</C> reads <C>~/.claude/.credentials.json</C> and returns{" "}
          <C>{"{ plan: \"free\" | \"pro\" | \"max\" | \"api\" }"}</C>. Used by the UI to surface
          plan-appropriate defaults.
        </P>
      </Card>
    </>
  );
}

// ── Right-rail anchor nav ─────────────────────────────────────────────────

type AnchorEntry = { id: string; label: string };

const TAB_ANCHORS: Record<TabId, AnchorEntry[]> = {
  "getting-started": [
    { id: "introduction",     label: "What is Agent Office?" },
    { id: "prerequisites",    label: "What you need" },
    { id: "quick-start",      label: "Quick Start" },
    { id: "first-run-wizard", label: "First-run wizard" },
  ],
  agents: [
    { id: "agents",        label: "Agent files" },
    { id: "frontmatter",   label: "Frontmatter" },
    { id: "system-prompt", label: "System prompt" },
    { id: "skills",        label: "Skills" },
  ],
  projects: [
    { id: "projects", label: "Projects" },
  ],
  memory: [
    { id: "memory", label: "Memory tiers" },
  ],
  usage: [
    { id: "office",         label: "Office floor" },
    { id: "summon",         label: "Summon & Runs" },
    { id: "history",        label: "Run history" },
    { id: "pipelines",      label: "Pipelines" },
    { id: "multi-instance", label: "Multi-instance" },
    { id: "spend-limits",   label: "Spend limits" },
    { id: "processes",      label: "Processes" },
  ],
  reference: [
    { id: "storage",        label: "Storage" },
    { id: "save-export",    label: "Save / Export" },
    { id: "rest-api",       label: "REST API" },
    { id: "sse-events",     label: "SSE Events" },
    { id: "db-schema",      label: "Database schema" },
    { id: "build-run",      label: "Build & Run" },
    { id: "other-features", label: "Other features" },
  ],
};

function DocsAside({
  anchors,
  scrollContainer,
}: {
  anchors: AnchorEntry[];
  scrollContainer: React.RefObject<HTMLDivElement | null>;
}) {
  const [activeId, setActiveId] = useState<string>(anchors[0]?.id ?? "");

  useEffect(() => {
    setActiveId(anchors[0]?.id ?? "");
  }, [anchors]);

  useEffect(() => {
    if (anchors.length === 0) return;

    const root = scrollContainer.current ?? undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost entry that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) {
          setActiveId(first.target.id);
        }
      },
      {
        root,
        rootMargin: "0px 0px -60% 0px",
        threshold: 0,
      },
    );

    const elements = anchors
      .map((a) => document.getElementById(a.id))
      .filter(Boolean) as HTMLElement[];

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [anchors, scrollContainer]);

  if (anchors.length === 0) return null;

  return (
    <aside className="hidden md:block w-[200px] flex-shrink-0">
      <nav
        className="sticky top-5 flex flex-col gap-0.5"
        aria-label="On this page"
      >
        <span className={`font-[var(--font-mono)] text-[8px] font-bold tracking-[0.18em] uppercase text-[var(--txt-4)] px-2 pb-2 select-none`}>
          On this page
        </span>
        {anchors.map((a) => {
          const isActive = activeId === a.id;
          return (
            <a
              key={a.id}
              href={`#${a.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(a.id);
                if (el && scrollContainer.current) {
                  scrollContainer.current.scrollTo({
                    top: el.offsetTop - 20,
                    behavior: "smooth",
                  });
                }
              }}
              className={`
                text-[12px] leading-[1.4] px-2 py-1.5 rounded-[5px] transition-colors duration-100
                ${isActive
                  ? "font-semibold text-[var(--acc)] bg-[var(--acc-faint)]"
                  : "text-[var(--txt-3)] hover:text-[var(--txt-2)] hover:bg-[var(--bg-2)]"}
              `}
            >
              {a.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  "getting-started": <GettingStarted />,
  agents:            <AgentsTab />,
  projects:          <ProjectsTab />,
  memory:            <MemoryTab />,
  usage:             <UsageTab />,
  reference:         <ReferenceTab />,
};

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("getting-started");
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg-0)]">
      {/* ── Header + tabs ───────────────────────────────── */}
      <div className={`flex-shrink-0 bg-[var(--bg-1)] border-b ${B}`}>
        <div className="max-w-[1280px] mx-auto px-6 pb-0 pt-7">
          <div className="flex items-baseline gap-2.5 mb-3">
            <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--txt)] leading-none">
              Documentation
            </h1>
            <span className="text-[10.5px] text-[var(--txt-4)] font-[var(--font-mono)]">Agent Office v{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}</span>
          </div>

          {/* Tab bar */}
          <div className="flex">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); scrollRef.current?.scrollTo({ top: 0 }); }}
                  className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`}
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
        <div className="max-w-[1280px] mx-auto flex gap-6 px-6 pt-5 pb-10">
          <div className="flex-1 min-w-0">
            {TAB_CONTENT[activeTab]}
          </div>
          <DocsAside anchors={TAB_ANCHORS[activeTab]} scrollContainer={scrollRef} />
        </div>
      </div>
    </div>
  );
}
