'use client';

import { useState } from 'react';

const NAV = [
  { id: 'introduction',   label: 'Introduction' },
  { id: 'prerequisites',  label: 'Prerequisites' },
  { id: 'quick-start',    label: 'Quick Start' },
  { id: 'agents',         label: 'Agent Files' },
  { id: 'frontmatter',    label: 'Frontmatter Reference', indent: true },
  { id: 'system-prompt',  label: 'System Prompt', indent: true },
  { id: 'skills',         label: 'Skills' },
  { id: 'projects',       label: 'Projects' },
  { id: 'memory',         label: 'Memory System' },
  { id: 'office',         label: 'The Office Floor' },
  { id: 'summon',         label: 'Summon & Runs' },
  { id: 'history',        label: 'Run History' },
  { id: 'storage',        label: 'Data & Storage' },
  { id: 'architecture',   label: 'Architecture' },
];

function Code({ children }: { children: string }) {
  return <code className="docs-inline-code">{children}</code>;
}

function Pre({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="docs-pre-wrap">
      {lang && <span className="docs-pre-lang">{lang}</span>}
      <pre className="docs-pre"><code>{children}</code></pre>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children, kind = 'info' }: { children: React.ReactNode; kind?: 'info' | 'warn' | 'tip' }) {
  const icons = { info: 'ℹ', warn: '⚠', tip: '→' };
  return (
    <div className={`docs-note docs-note-${kind}`}>
      <span className="docs-note-icon">{icons[kind]}</span>
      <div>{children}</div>
    </div>
  );
}

export default function DocsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="/">
            <span className="mark">O</span>
            <span>Agent Office</span>
            <span className="v">v0.1</span>
          </a>
          <div className="nav-links">
            <a href="/#how">How it works</a>
            <a href="/#features">Features</a>
            <a href="/#specs">Specs</a>
            <a href="/#faq">FAQ</a>
          </div>
          <div className="right">
            <span className="beta-pill"><span className="led"></span> Closed Beta</span>
            <span className="tooltip-disabled" data-tooltip="Temporarily disabled">
              <a href="/#beta" className="cta">Request Access</a>
            </span>
          </div>
        </div>
      </nav>

      {/* ── Docs layout ────────────────────────────────────────── */}
      <div className="docs-layout">

        {/* Mobile sidebar toggle */}
        <button
          className="docs-mobile-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle navigation"
        >
          <span className="docs-mobile-toggle-icon">{sidebarOpen ? '✕' : '☰'}</span>
          <span>Contents</span>
        </button>

        {/* Sidebar */}
        <aside className={`docs-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="docs-sidebar-inner">
            <div className="docs-sidebar-label">Documentation</div>
            <nav>
              {NAV.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`docs-nav-link${item.indent ? ' indent' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="docs-sidebar-footer">
              <a href="/">← Back to home</a>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div className="docs-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="docs-main">
          <div className="docs-content">

            {/* ── Introduction ────────────────────────────────── */}
            <section id="introduction" className="docs-section">
              <div className="docs-eyebrow">Introduction</div>
              <h1 className="docs-h1">Agent Office Docs</h1>
              <p className="docs-lead">
                Agent Office is a desktop app that gives your Claude Code agents a visual home.
                You define agents as plain <Code>.md</Code> files, roster them to projects,
                summon them with a prompt, and watch output stream back in real time -
                all stored locally in SQLite.
              </p>
              <p className="docs-p">
                This documentation covers everything from installation to the internals:
                agent file format, the skills system, project and memory management,
                the isometric office floor, how runs are spawned and streamed, and what
                lives where on disk.
              </p>
              <Note kind="info">
                Agent Office is in closed beta. It wraps the Claude Code CLI - you need
                that installed and an Anthropic API key configured before Agent Office
                will do anything useful.
              </Note>
            </section>

            {/* ── Prerequisites ───────────────────────────────── */}
            <section id="prerequisites" className="docs-section">
              <div className="docs-eyebrow">Prerequisites</div>
              <h2 className="docs-h2">What you need before you start</h2>
              <p className="docs-p">
                Agent Office does not ship its own AI runtime. It orchestrates the
                official Claude Code CLI. Three things must be in place:
              </p>

              <h3 className="docs-h3">1. Claude Code CLI</h3>
              <p className="docs-p">
                Install the official Anthropic Claude Code CLI. It must be on your
                <Code>PATH</Code> so Agent Office can spawn it as a subprocess.
              </p>
              <Pre lang="bash">{`npm install -g @anthropic-ai/claude-code
# or follow Anthropic's official install docs`}</Pre>
              <p className="docs-p">Verify it works:</p>
              <Pre lang="bash">{`claude --version`}</Pre>

              <h3 className="docs-h3">2. Anthropic API key</h3>
              <p className="docs-p">
                Claude Code reads your key from the environment. Set it once in your
                shell profile and every agent run picks it up automatically:
              </p>
              <Pre lang="bash">{`# ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-..."

# Then reload
source ~/.bashrc`}</Pre>
              <Note kind="warn">
                Agent Office never reads, stores, or transmits your API key.
                It only inherits the environment when spawning <Code>claude</Code> subprocesses.
                The key stays on your machine and goes directly to Anthropic.
              </Note>

              <h3 className="docs-h3">3. Operating system</h3>
              <Table
                headers={['Platform', 'Status', 'Notes']}
                rows={[
                  ['Linux (x64)', 'Ships first', '.deb and AppImage'],
                  ['macOS', 'After Linux', 'Universal binary planned'],
                  ['Windows', 'After macOS', 'NSIS installer planned'],
                ]}
              />
            </section>

            {/* ── Quick Start ─────────────────────────────────── */}
            <section id="quick-start" className="docs-section">
              <div className="docs-eyebrow">Quick Start</div>
              <h2 className="docs-h2">Up and running in three steps</h2>

              <div className="docs-steps">
                <div className="docs-step">
                  <div className="docs-step-num">01</div>
                  <div className="docs-step-body">
                    <h3 className="docs-step-title">Create your first agent</h3>
                    <p className="docs-p">
                      Drop a Markdown file into <Code>~/.claude/agents/</Code>.
                      The filename becomes the agent ID.
                    </p>
                    <Pre lang="bash">{`mkdir -p ~/.claude/agents
cat > ~/.claude/agents/developer.md << 'EOF'
---
name: developer
description: Senior full-stack engineer. Writes and refactors production code.
default-model: claude-sonnet-4-5
default-effort: high
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
permission-mode: bypassPermissions
---

You are a senior full-stack developer specializing in TypeScript and React.
You write clean, well-tested code and always explain your changes.
EOF`}</Pre>
                  </div>
                </div>

                <div className="docs-step">
                  <div className="docs-step-num">02</div>
                  <div className="docs-step-body">
                    <h3 className="docs-step-title">Open Agent Office</h3>
                    <p className="docs-p">
                      Launch the app. It scans <Code>~/.claude/agents/</Code> on startup
                      and builds your roster automatically. Your <Code>developer</Code> agent
                      appears in the sidebar.
                    </p>
                    <Note kind="tip">
                      The first run wizard asks for your projects root directory
                      (e.g. <Code>~/projects</Code>). Every subdirectory there becomes a project.
                    </Note>
                  </div>
                </div>

                <div className="docs-step">
                  <div className="docs-step-num">03</div>
                  <div className="docs-step-body">
                    <h3 className="docs-step-title">Summon the agent</h3>
                    <p className="docs-p">
                      Click on an agent in the roster, select a project, type a prompt,
                      and hit Enter. Output streams back line by line. When the run
                      finishes the full transcript is saved to SQLite.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Agents ──────────────────────────────────────── */}
            <section id="agents" className="docs-section">
              <div className="docs-eyebrow">Agent Files</div>
              <h2 className="docs-h2">How agents are defined</h2>
              <p className="docs-p">
                Every agent is a Markdown file at <Code>~/.claude/agents/&lt;id&gt;.md</Code>.
                The YAML frontmatter configures the agent; the body after the
                <Code>---</Code> fence becomes part of the system prompt Agent Office
                passes to Claude Code on each summon.
              </p>
              <p className="docs-p">
                Agent Office uses the exact same file format Claude Code already reads.
                If you have existing Claude Code agent definitions, they just work.
                No migration, no new tooling.
              </p>

              <h3 className="docs-h3">File layout</h3>
              <Pre lang="bash">{`~/.claude/agents/
├── developer.md          # Agent definition
├── developer.memory.md   # Per-agent persistent memory (auto-created)
├── agent-architect.md
├── qa-runtime.md
├── _global.memory.md     # Global memory injected into every agent
└── _skills/              # Installed skill packs
    ├── webapp-testing/
    │   └── SKILL.md
    └── _registry.json    # Skill registry cache`}</Pre>

              <Note kind="info">
                Files starting with <Code>_</Code> are internal (global memory, skills).
                Files ending with <Code>.memory.md</Code> are memory sidecars.
                Only bare <Code>&lt;id&gt;.md</Code> files become agents.
              </Note>
            </section>

            {/* ── Frontmatter ─────────────────────────────────── */}
            <section id="frontmatter" className="docs-section">
              <div className="docs-eyebrow">Agent Files · Frontmatter</div>
              <h2 className="docs-h2">Frontmatter reference</h2>
              <p className="docs-p">
                All fields are optional. Unset fields fall back to app-level defaults.
              </p>
              <Pre lang="yaml">{`---
name: developer
description: Senior full-stack engineer. Writes and refactors production code.
default-model: claude-sonnet-4-5
default-effort: high
skills:
  - webapp-testing
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
permission-mode: bypassPermissions
room: room-a
unit: blue/warrior
---`}</Pre>

              <Table
                headers={['Field', 'Type', 'Default', 'Description']}
                rows={[
                  [<Code>name</Code>, 'string', 'filename', 'Display name shown in the UI'],
                  [<Code>description</Code>, 'string', '""', 'Short description shown on agent cards'],
                  [<Code>default-model</Code>, 'string', 'app default', 'Claude model slug, e.g. claude-sonnet-4-5, claude-opus-4-5'],
                  [<Code>default-effort</Code>, 'string', 'medium', 'Thinking budget: low · medium · high'],
                  [<Code>skills</Code>, 'list', '[]', 'Names of installed skills to append to the system prompt'],
                  [<Code>tools</Code>, 'list', '[]', 'Tools the agent is allowed to use (passed as --allowedTools)'],
                  [<Code>permission-mode</Code>, 'string', 'default', 'default · bypassPermissions · plan'],
                  [<Code>room</Code>, 'string', '', 'Office room name for desk placement persistence'],
                  [<Code>unit</Code>, 'string', 'auto', 'Avatar sprite override: "faction/kind" e.g. "blue/warrior"'],
                ]}
              />

              <h3 className="docs-h3">permission-mode values</h3>
              <Table
                headers={['Value', 'Behaviour']}
                rows={[
                  ['default', 'Claude Code prompts for permission on potentially destructive actions'],
                  ['bypassPermissions', 'All permissions auto-approved — use for trusted automation agents'],
                  ['plan', 'Read-only planning mode; agent can read files but not write or execute'],
                ]}
              />

              <h3 className="docs-h3">tools reference</h3>
              <p className="docs-p">
                Any tool name accepted by Claude Code is valid here. Common ones:
              </p>
              <Table
                headers={['Tool', 'Description']}
                rows={[
                  ['Read', 'Read file contents'],
                  ['Write', 'Write or overwrite a file'],
                  ['Edit', 'Targeted string replacement in a file'],
                  ['Bash', 'Run shell commands'],
                  ['Glob', 'List files matching a pattern'],
                  ['Grep', 'Search file contents'],
                  ['TodoRead / TodoWrite', 'Read and write the agent TODO list'],
                  ['WebSearch / WebFetch', 'Search the web or fetch a URL'],
                ]}
              />
            </section>

            {/* ── System Prompt ───────────────────────────────── */}
            <section id="system-prompt" className="docs-section">
              <div className="docs-eyebrow">Agent Files · System Prompt</div>
              <h2 className="docs-h2">How the system prompt is assembled</h2>
              <p className="docs-p">
                When you summon an agent, Agent Office builds an appended prompt that
                Claude Code receives alongside your message. The composition order is
                fixed and deterministic:
              </p>
              <div className="docs-flow">
                <div className="docs-flow-step">
                  <span className="docs-flow-n">1</span>
                  <div>
                    <strong>Skills</strong>
                    <span className="docs-flow-desc">Bodies of all installed skills listed in the agent's <Code>skills</Code> field, concatenated in order</span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">2</span>
                  <div>
                    <strong>Global memory</strong>
                    <span className="docs-flow-desc">Contents of <Code>~/.claude/agents/_global.memory.md</Code> — applies to every agent</span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">3</span>
                  <div>
                    <strong>Project context</strong>
                    <span className="docs-flow-desc">Active project name, working directory, and description when a project is selected</span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">4</span>
                  <div>
                    <strong>Project memory</strong>
                    <span className="docs-flow-desc">The memory body from <Code>~/.claude/projects/&lt;id&gt;/project.md</Code></span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">5</span>
                  <div>
                    <strong>Per-agent memory</strong>
                    <span className="docs-flow-desc">Contents of <Code>~/.claude/agents/&lt;id&gt;.memory.md</Code></span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">6</span>
                  <div>
                    <strong>History note</strong>
                    <span className="docs-flow-desc">A reminder of the SQLite path so the agent can query its own past runs. Omitted in plan mode.</span>
                  </div>
                </div>
              </div>
              <Note kind="tip">
                The body of the <Code>.md</Code> file (everything after the closing <Code>---</Code>)
                is passed directly as the Claude Code <Code>--system-prompt</Code>. All the items
                above are injected as an <em>appended</em> prompt, not as a replacement.
              </Note>
            </section>

            {/* ── Skills ──────────────────────────────────────── */}
            <section id="skills" className="docs-section">
              <div className="docs-eyebrow">Skills</div>
              <h2 className="docs-h2">Reusable capability packs</h2>
              <p className="docs-p">
                A skill is a directory at <Code>~/.claude/agents/_skills/&lt;name&gt;/</Code>
                containing a <Code>SKILL.md</Code> file. When an agent has a skill in its
                <Code>skills</Code> list, the body of that <Code>SKILL.md</Code> is prepended
                to every summon as part of the system prompt.
              </p>
              <p className="docs-p">
                Skills are good for reusable instructions like "here's how to use Playwright",
                "here's our API client SDK reference", or "here's the house coding style."
                Multiple agents can share the same skill.
              </p>

              <h3 className="docs-h3">Skill file format</h3>
              <Pre lang="markdown">{`---
name: webapp-testing
description: Browser-based QA using Playwright. Drives a real Chromium.
---

## How to test web apps

Use the Playwright MCP server already configured in your environment.
Navigate to the app, take screenshots to /tmp, assert DOM state...`}</Pre>

              <h3 className="docs-h3">Installing from the registry</h3>
              <p className="docs-p">
                Agent Office ships a built-in skill registry that indexes published skill
                packs from several GitHub sources. Browse and install them from the
                <strong> Settings → Skills</strong> panel inside the app.
              </p>
              <p className="docs-p">Registry sources indexed by default:</p>
              <Table
                headers={['Source', 'Tags']}
                rows={[
                  ['anthropics/skills', 'anthropic · official'],
                  ['tradermonty/claude-trading-skills', 'trading · community'],
                  ['Orchestra-Research/AI-research-SKILLs', 'ai-research · ml · community'],
                  ['numman-ali/openskills', 'example · community'],
                ]}
              />
              <p className="docs-p">
                The registry is cached for one hour at
                <Code>~/.claude/agents/_skills/_registry.json</Code>.
                Use the refresh button in the UI to force a re-fetch.
              </p>

              <h3 className="docs-h3">Writing a local skill</h3>
              <Pre lang="bash">{`mkdir -p ~/.claude/agents/_skills/my-skill
cat > ~/.claude/agents/_skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: Describes what this skill teaches the agent.
---

## My instructions

Everything in this section is injected into the agent's system prompt.
EOF`}</Pre>
              <p className="docs-p">
                Then reference it in any agent's frontmatter:
              </p>
              <Pre lang="yaml">{`skills:
  - my-skill`}</Pre>
            </section>

            {/* ── Projects ────────────────────────────────────── */}
            <section id="projects" className="docs-section">
              <div className="docs-eyebrow">Projects</div>
              <h2 className="docs-h2">Scoping agents to a codebase</h2>
              <p className="docs-p">
                A project is any directory inside your configured <em>projects root</em>
                (set during first-run setup, default <Code>~/projects</Code>).
                Agent Office scans that directory on every startup and automatically
                surfaces every subdirectory as a project.
              </p>

              <h3 className="docs-h3">Project metadata file</h3>
              <p className="docs-p">
                Each project can optionally have a metadata file at
                <Code>~/.claude/projects/&lt;id&gt;/project.md</Code>. The YAML frontmatter
                stores the roster; the Markdown body is project-level memory injected
                into every summon.
              </p>
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
- Components go in src/components/
- All routes under src/app/
- Never commit .env files`}</Pre>

              <h3 className="docs-h3">Roster instances</h3>
              <p className="docs-p">
                Adding an agent to a project creates an <em>instance</em>: a copy of the
                agent with its own <Code>instanceId</Code>, its own conversation history,
                and optionally overridden model/effort/permission settings. The same
                base agent definition can appear in multiple projects with independent
                conversation threads.
              </p>
              <Table
                headers={['Instance field', 'Description']}
                rows={[
                  [<Code>instanceId</Code>, 'Unique ID for this agent in this project. Auto-generated.'],
                  [<Code>agentId</Code>, 'The base agent filename (without .md)'],
                  [<Code>label</Code>, 'Optional display label override'],
                  [<Code>model</Code>, 'Overrides the agent\'s default-model for this project'],
                  [<Code>effort</Code>, 'Overrides the agent\'s default-effort for this project'],
                  [<Code>permissionMode</Code>, 'Overrides the agent\'s permission-mode for this project'],
                ]}
              />

              <h3 className="docs-h3">Working directory</h3>
              <p className="docs-p">
                When a project is selected, its <Code>cwd</Code> (the full path to the
                project folder) is passed to every <Code>claude</Code> subprocess as the
                working directory. The agent therefore sees your project files when it
                runs <Code>Read</Code>, <Code>Edit</Code>, or <Code>Bash</Code> calls.
              </p>
            </section>

            {/* ── Memory ──────────────────────────────────────── */}
            <section id="memory" className="docs-section">
              <div className="docs-eyebrow">Memory System</div>
              <h2 className="docs-h2">Persistent context across runs</h2>
              <p className="docs-p">
                Agent Office has three tiers of persistent memory. All are plain
                Markdown files you can edit directly in any text editor.
              </p>

              <h3 className="docs-h3">Global memory</h3>
              <p className="docs-p">
                <Code>~/.claude/agents/_global.memory.md</Code> — injected into
                <em>every</em> agent on every summon. Use it for things that apply
                universally: your name, working preferences, team norms, tool conventions.
              </p>
              <Pre lang="markdown">{`# Global memory

User: Alex. Prefers concise explanations. Works on a Linux machine.
Always use pnpm, never npm. TypeScript strict mode everywhere.
Tests go next to source files, not in a separate __tests__ folder.`}</Pre>

              <h3 className="docs-h3">Project memory</h3>
              <p className="docs-p">
                The Markdown body in <Code>~/.claude/projects/&lt;id&gt;/project.md</Code>
                is injected for all agents working on that project. Use it for
                project-specific conventions, architecture notes, and gotchas.
              </p>

              <h3 className="docs-h3">Per-agent memory</h3>
              <p className="docs-p">
                <Code>~/.claude/agents/&lt;id&gt;.memory.md</Code> — injected only when
                that specific agent is summoned. Created automatically the first time
                you save memory from the agent detail panel.
              </p>

              <h3 className="docs-h3">Editing memory from the UI</h3>
              <p className="docs-p">
                Open any agent's detail panel → <strong>Memory</strong> tab. The editor
                shows all three memory tiers. Changes are saved to disk immediately.
                The next summon picks them up automatically - no restart needed.
              </p>

              <Note kind="tip">
                Agents can update their own memory during a run by writing to their
                memory file (if they have <Code>Write</Code> tool access and
                <Code>bypassPermissions</Code> mode). This is how you give an agent
                the ability to remember things across sessions.
              </Note>
            </section>

            {/* ── Office Floor ────────────────────────────────── */}
            <section id="office" className="docs-section">
              <div className="docs-eyebrow">The Office Floor</div>
              <h2 className="docs-h2">The isometric workspace</h2>
              <p className="docs-p">
                The Office is the main view: an isometric pixel floor where each
                rostered agent has a desk tile. Status LEDs show at a glance which
                agents are running, thinking, idle, or errored. The floor is ambient -
                you check it when you want to, not because you have to.
              </p>

              <h3 className="docs-h3">Navigation</h3>
              <Table
                headers={['Action', 'Input']}
                rows={[
                  ['Pan the floor', 'Click and drag on empty tiles'],
                  ['Zoom in/out', 'Scroll wheel or pinch gesture'],
                  ['Reset camera', 'Click the recenter button in the toolbar'],
                  ['Open agent detail', 'Click on an agent sprite'],
                  ['Search agents', 'Type in the search bar in the toolbar'],
                ]}
              />

              <h3 className="docs-h3">Agent status indicators</h3>
              <Table
                headers={['LED colour', 'Status', 'Meaning']}
                rows={[
                  ['Green (pulsing)', 'running / working', 'Agent is actively executing a run'],
                  ['Orange (pulsing)', 'thinking', 'Agent is in extended thinking mode'],
                  ['White (solid)', 'done', 'Last run completed successfully'],
                  ['Red (solid)', 'error', 'Last run ended with an error'],
                  ['Off', 'idle', 'No recent activity'],
                ]}
              />

              <h3 className="docs-h3">Build mode</h3>
              <p className="docs-p">
                Click the <strong>Build</strong> button (bottom-right) to enter build mode.
                In build mode you can customise the office floor layout:
              </p>
              <Table
                headers={['Tool', 'Description']}
                rows={[
                  ['Paint', 'Paint grass tiles to expand land area'],
                  ['Erase', 'Remove tiles or decorations (agent → top decoration → terrain, in that order)'],
                  ['Decorations', 'Place trees, buildings, rocks, bridges, and more from the palette'],
                  ['Island colour', 'Change the grass tint from the colour swatches'],
                ]}
              />
              <p className="docs-p">
                Click <strong>Save changes</strong> in the action bar to persist
                the layout. Changes are stored per-project in the database.
              </p>
            </section>

            {/* ── Summon ──────────────────────────────────────── */}
            <section id="summon" className="docs-section">
              <div className="docs-eyebrow">Summon & Runs</div>
              <h2 className="docs-h2">Sending agents to work</h2>
              <p className="docs-p">
                Clicking an agent on the floor opens the conversation panel. From here
                you send prompts, watch output stream live, and review past turns.
              </p>

              <h3 className="docs-h3">How a run works under the hood</h3>
              <div className="docs-flow">
                <div className="docs-flow-step">
                  <span className="docs-flow-n">1</span>
                  <div>
                    <strong>Spawn</strong>
                    <span className="docs-flow-desc">
                      Agent Office calls <Code>claude --output-format stream-json --print ...</Code>
                      as a child process. The appended prompt, tool list, model, and effort flags
                      are all passed as CLI arguments.
                    </span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">2</span>
                  <div>
                    <strong>Stream</strong>
                    <span className="docs-flow-desc">
                      stdout is parsed line-by-line as newline-delimited JSON. Each token chunk,
                      tool call, usage report, and completion event is broadcast over SSE to all
                      connected browser tabs in real time.
                    </span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">3</span>
                  <div>
                    <strong>Persist</strong>
                    <span className="docs-flow-desc">
                      When the process exits, the full run record (prompt, output, token counts,
                      cost, duration, session ID) is written to SQLite.
                    </span>
                  </div>
                </div>
                <div className="docs-flow-step">
                  <span className="docs-flow-n">4</span>
                  <div>
                    <strong>Resume</strong>
                    <span className="docs-flow-desc">
                      Claude Code returns a session ID at the end of each run. The next message
                      in the same conversation thread passes <Code>--resume &lt;sessionId&gt;</Code>
                      so the agent retains full context.
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="docs-h3">Multi-instance agents</h3>
              <p className="docs-p">
                You can add the same base agent to a project multiple times as separate
                instances. Each instance has its own conversation thread and can run
                concurrently. Use this to run the same developer agent on two tasks
                in parallel.
              </p>

              <h3 className="docs-h3">Pipelines</h3>
              <p className="docs-p">
                The pipeline API lets you chain agent runs programmatically.
                Steps can be sequential (the output of step N is passed as
                <Code>{'{{output}}'}</Code> in step N+1's prompt template) or
                parallel (a group of steps all run at the same time; their
                outputs are joined for the next step).
              </p>

              <h3 className="docs-h3">Aborting a run</h3>
              <p className="docs-p">
                The <strong>Abort</strong> button (or <Code>Escape</Code>) sends SIGTERM to the
                <Code>claude</Code> subprocess. The partial output is preserved in SQLite
                with an exit code of <Code>130</Code>. You can resume the conversation
                from that point.
              </p>

              <h3 className="docs-h3">Spend limits</h3>
              <p className="docs-p">
                Set a USD budget cap per run in the agent settings or the summon dialog.
                If the running cost exceeds the cap, the run is aborted automatically.
                Per-session token usage is always visible in the conversation header.
              </p>
            </section>

            {/* ── History ─────────────────────────────────────── */}
            <section id="history" className="docs-section">
              <div className="docs-eyebrow">Run History</div>
              <h2 className="docs-h2">Every run, stored forever</h2>
              <p className="docs-p">
                All run data lives in a local SQLite database at
                <Code>~/.claude/agent-office/db.sqlite</Code>. Nothing is sent
                to any server. The file is yours - back it up, query it directly,
                or delete it to start fresh.
              </p>

              <h3 className="docs-h3">What's stored per run</h3>
              <Table
                headers={['Field', 'Description']}
                rows={[
                  ['id', 'UUID for the run'],
                  ['agentId / agentName', 'Which agent ran'],
                  ['projectId / instanceId', 'Which project and instance'],
                  ['prompt', 'The full user prompt sent'],
                  ['output', 'Full plain-text transcript of the run'],
                  ['status', 'done · error · running'],
                  ['exitCode', 'Subprocess exit code (130 = aborted)'],
                  ['tokensIn / tokensOut', 'Input and output token counts'],
                  ['cost', 'USD cost reported by the API'],
                  ['durMs', 'Wall-clock duration in milliseconds'],
                  ['model / effort', 'Model slug and effort level used'],
                  ['sessionId', 'Claude Code session ID for conversation resumption'],
                ]}
              />

              <h3 className="docs-h3">Querying directly with sqlite3</h3>
              <Pre lang="bash">{`sqlite3 ~/.claude/agent-office/db.sqlite

# All runs for the developer agent
SELECT ts, prompt, status, cost
FROM runs
WHERE agent_id = 'developer'
ORDER BY ts DESC
LIMIT 20;

# Total spend by agent this month
SELECT agent_name, ROUND(SUM(cost), 4) AS total_usd
FROM runs
WHERE started_at > strftime('%s', 'now', '-30 days') * 1000
GROUP BY agent_name
ORDER BY total_usd DESC;`}</Pre>

              <Note kind="info">
                Agents themselves are told the path to the database in every system prompt
                (as part of the history note). An agent with <Code>Bash</Code> access can
                query its own past runs using <Code>sqlite3</Code> - this is how
                long-running agents maintain awareness of what they've done across sessions.
              </Note>
            </section>

            {/* ── Storage ─────────────────────────────────────── */}
            <section id="storage" className="docs-section">
              <div className="docs-eyebrow">Data & Storage</div>
              <h2 className="docs-h2">What lives where on disk</h2>
              <p className="docs-p">
                Agent Office writes to two directories under your home folder.
                Everything is plain files or SQLite - nothing proprietary.
              </p>

              <Pre lang="bash">{`~/.claude/
│
├── agents/                         # Agent definitions (you own these)
│   ├── <id>.md                     # Agent definition + system prompt body
│   ├── <id>.memory.md              # Per-agent persistent memory
│   ├── _global.memory.md           # Global memory (all agents)
│   └── _skills/                    # Installed skill packs
│       ├── <skill-name>/
│       │   ├── SKILL.md
│       │   └── .source.json        # Install provenance (source, sha)
│       └── _registry.json          # Cached skill registry (1hr TTL)
│
├── projects/                       # Project metadata (Agent Office writes)
│   └── <project-id>/
│       └── project.md              # Roster + project memory
│
└── agent-office/                   # App state (Agent Office writes)
    └── db.sqlite                   # All runs, transcripts, office layouts`}</Pre>

              <h3 className="docs-h3">Size expectations</h3>
              <Table
                headers={['Data', 'Typical size']}
                rows={[
                  ['Agent .md file', '< 10 KB'],
                  ['Memory file', '< 256 KB (enforced)'],
                  ['Single run in SQLite', '5 – 200 KB depending on output length'],
                  ['db.sqlite after 1 year heavy use', '100 MB – 2 GB'],
                  ['Skill pack', '5 – 500 KB'],
                ]}
              />

              <h3 className="docs-h3">Backups</h3>
              <p className="docs-p">
                The SQLite database uses WAL mode. To take a safe backup at any
                time without stopping the app:
              </p>
              <Pre lang="bash">{`sqlite3 ~/.claude/agent-office/db.sqlite \
  ".backup ~/.claude/agent-office/db.sqlite.bak"`}</Pre>
            </section>

            {/* ── Architecture ────────────────────────────────── */}
            <section id="architecture" className="docs-section">
              <div className="docs-eyebrow">Architecture</div>
              <h2 className="docs-h2">How it's built</h2>
              <p className="docs-p">
                Agent Office is a Tauri 2 desktop app. The Rust shell handles the
                window, system tray, and OS integration. The actual app logic runs
                in a Node.js server embedded inside the Tauri binary.
              </p>

              <h3 className="docs-h3">Stack</h3>
              <Table
                headers={['Layer', 'Technology', 'Role']}
                rows={[
                  ['Desktop shell', 'Tauri 2 (Rust)', 'Window management, auto-update, OS integration'],
                  ['Backend', 'Next.js 15 (Node.js)', 'API routes, SSE streaming, process management'],
                  ['Frontend', 'Next.js 15 (React 19)', 'UI rendered in the Tauri webview'],
                  ['Database', 'better-sqlite3', 'Synchronous local SQLite, WAL mode'],
                  ['Agents dir', 'Plain filesystem', 'Reads ~/.claude/agents/ at runtime'],
                  ['AI runtime', 'Claude Code CLI', 'Spawned as a subprocess per run'],
                ]}
              />

              <h3 className="docs-h3">Run lifecycle (detailed)</h3>
              <Pre lang="text">{`UI sends POST /api/summon
  │
  ├─ Server calls buildAppendedPrompt()
  │    Skills → Global memory → Project → Project memory → Agent memory → History note
  │
  ├─ Server spawns:  claude \\
  │    --output-format stream-json \\
  │    --print "<prompt>" \\
  │    --system-prompt "<appended>" \\
  │    --model <model> \\
  │    --allowedTools <tools> \\
  │    [--resume <sessionId>]  ← if continuing a conversation
  │
  ├─ stdout is parsed line-by-line as NDJSON
  │    { type: "text", text: "..." }         → SSE "chunk" event
  │    { type: "tool_use", name: "..." }     → SSE "tool" event
  │    { type: "usage", ... }                → SSE "usage" event
  │
  ├─ Browser tab opens GET /api/runs/<id>/stream (SSE)
  │    Events replay from in-memory log for late joiners
  │    Browser rebuilds the thread in real time
  │
  └─ On process exit
       Final record written to SQLite
       SSE "done" event sent to all subscribers`}</Pre>

              <h3 className="docs-h3">Server-side persistence across HMR</h3>
              <p className="docs-p">
                The live-run registry and database connection are attached to
                <Code>globalThis</Code> with stable keys. This means a hot module
                reload during development does not kill running subprocesses or
                lose in-flight SSE subscribers - the new module version reattaches
                to the same process handles.
              </p>

              <h3 className="docs-h3">PATH augmentation</h3>
              <p className="docs-p">
                When Tauri launches the app from a desktop shortcut the process
                has a minimal environment - no <Code>.bashrc</Code>, no NVM.
                Agent Office augments <Code>PATH</Code> before spawning any
                subprocess by scanning <Code>~/.nvm/versions/node/</Code> and
                prepending all installed Node bin directories, then adding
                <Code>~/.local/bin</Code>, <Code>/usr/local/bin</Code>, and
                <Code>/usr/bin</Code>. This ensures <Code>claude</Code> is always
                found even in stripped desktop session environments.
              </p>
            </section>

          </div>
        </main>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <a className="brand" href="/">
              <span className="mark">O</span>
              <span>Agent Office</span>
            </a>
            <p className="tag">A desktop workspace for Claude Code agents. Runs locally, stores everything on-device.</p>
          </div>
          <div className="footer-col">
            <h6>Product</h6>
            <a href="/#how">How it works</a>
            <a href="/#features">Features</a>
            <a href="/#specs">Specs</a>
            <a href="/#beta">Beta access</a>
          </div>
          <div className="footer-col">
            <h6>Resources</h6>
            <a href="/docs">Documentation</a>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>Changelog</a>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>Roadmap</a>
          </div>
          <div className="footer-col">
            <h6>Connect</h6>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>GitHub</a>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>Discord</a>
            <a href="mailto:hello.arturas.miceika@gmail.com">Email</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 AGENT OFFICE · <span className="mark">CLOSED BETA</span></span>
          <span>BUILT IN THE TERMINAL · SHIPPED ON THE DESKTOP</span>
        </div>
      </footer>
    </>
  );
}
