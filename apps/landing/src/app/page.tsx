'use client';

import { useEffect, useState } from 'react';

const SUMMON_LINES = [
  { text: '$ summon developer "clean up the auth module"', type: 'cmd' },
  { text: 'developer · spawning claude -p …', type: 'info' },
  { text: '→ Read · src/auth/session.ts', type: 'tool' },
  { text: '→ Read · src/auth/middleware.ts', type: 'tool' },
  { text: '→ Edit · src/auth/session.ts', type: 'tool' },
  { text: '   removed stale cookie check (was always true)', type: 'tool' },
  { text: '→ Edit · src/auth/middleware.ts', type: 'tool' },
  { text: '   simplified token validation - 3 checks → 1', type: 'tool' },
  { text: '✓ done · 2 files changed · $0.34', type: 'ok' },
];
const SUMMON_DELAYS = [0, 500, 1100, 1700, 2200, 2600, 3100, 3500, 4200];
const SUMMON_CYCLE = 7800;

function SummonDemo() {
  const [shown, setShown] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    function run() {
      setShown([]);
      SUMMON_DELAYS.forEach((d, i) => {
        setTimeout(() => { if (alive) setShown(s => [...s, i]); }, d);
      });
      setTimeout(() => {
        if (!alive) return;
        setShown([]);
        setTimeout(run, 600);
      }, SUMMON_CYCLE);
    }
    run();
    return () => { alive = false; };
  }, []);

  return (
    <div className="summon-demo">
      {SUMMON_LINES.map((line, i) => (
        <div key={i} className={`sl sl-${line.type} ${shown.includes(i) ? 'sl-vis' : ''} ${i === shown[shown.length - 1] && line.type !== 'ok' ? 'sl-cursor' : ''}`}>
          {line.text}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>

      {/* ============ NAV ============ */}
      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="#">
            <span className="mark">O</span>
            <span>Agent Office</span>
            <span className="v">v0.1</span>
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#specs">Specs</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="right">
            <span className="beta-pill"><span className="led"></span> Closed Beta</span>
            <span className="tooltip-disabled" data-tooltip="Temporarily disabled">
              <a href="#beta" className="cta">Request Access</a>
            </span>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero">
        <div className="hero-inner">
          <span className="hero-badge">
            <span className="chip">v0.1</span>
            <span>Closed beta · invites rolling</span>
            <span className="arrow">→</span>
          </span>

          <h1>
            Agents get desks.<br />
            <em>You get the view.</em>
          </h1>

          <p className="hero-sub">
            Agent Office is a desktop app for managing Claude Code agents -{' '}
            <strong>roster them to a project, summon them with a prompt, watch output stream back in real time.</strong>{' '}
            Built for people who already run Claude Code and want a better view of what's happening.
          </p>

          <div className="hero-ctas">
            <span className="tooltip-disabled" data-tooltip="Temporarily disabled">
              <a href="#beta" className="btn btn-primary">Request Beta Access <span className="arrow">→</span></a>
            </span>
            <a href="#how" className="btn btn-ghost">See how it works <span className="arrow">↓</span></a>
          </div>

          <div className="hero-meta">
            <div className="hero-meta-track">
              <span>Linux · macOS · Windows</span>
              <span className="sep">·</span>
              <span>Linux ships first</span>
              <span className="sep">·</span>
              <span>BYO Anthropic key</span>
              {/* duplicate for seamless mobile marquee loop */}
              <span className="hero-meta-dup">Linux · macOS · Windows</span>
              <span className="sep hero-meta-dup">·</span>
              <span className="hero-meta-dup">Linux ships first</span>
              <span className="sep hero-meta-dup">·</span>
              <span className="hero-meta-dup">BYO Anthropic key</span>
            </div>
          </div>
        </div>

        {/* App screenshot */}
        <div className="hero-screenshot">
          <img src="/screenshot.png" alt="Agent Office - The Office" />
        </div>
      </header>

      {/* ============ MARQUEE ============ */}
      <div className="marquee">
        <div className="marquee-track">
          <span>Claude Code CLI</span><span className="dot">▪</span>
          <span>Ubuntu-Styled</span><span className="dot">▪</span>
          <span>Isometric Office UI</span><span className="dot">▪</span>
          <span>Tauri 2</span><span className="dot">▪</span>
          <span>BYOK Compatible</span><span className="dot">▪</span>
          <span>Agent Memory</span><span className="dot">▪</span>
          <span>Local SQLite</span><span className="dot">▪</span>
          <span>Run History</span><span className="dot">▪</span>
          {/* duplicate for seamless loop */}
          <span>Claude Code CLI</span><span className="dot">▪</span>
          <span>Ubuntu-Styled</span><span className="dot">▪</span>
          <span>Isometric Office UI</span><span className="dot">▪</span>
          <span>Tauri 2</span><span className="dot">▪</span>
          <span>BYOK Compatible</span><span className="dot">▪</span>
          <span>Agent Memory</span><span className="dot">▪</span>
          <span>Local SQLite</span><span className="dot">▪</span>
          <span>Run History</span><span className="dot">▪</span>
        </div>
      </div>

      {/* ============ HOW IT WORKS ============ */}
      <section className="section" id="how">
        <div className="section-inner">
          <div className="eyebrow">
            <span className="n">01</span>
            <span className="dash"></span>
            <span>How it works</span>
          </div>
          <h2 className="bigtitle">
            From CLI prompt
            <em>to a running office.</em>
          </h2>
          <p className="lede">
            Three steps. Set up once, then summon agents the way you'd open a tab.
            Every step lives where you already work - no new tools to install beyond Claude Code.
          </p>

          <div className="steps">
            <div className="step">
              <div className="num">01</div>
              <h3>Drop in your agents.</h3>
              <p>
                Agent Office reads every <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '14px' }}>.md</code> file in <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-0)', fontSize: '14px' }}>~/.claude/agents/</code> and builds your roster automatically. The same files Claude Code already reads - no new format, no migration.
              </p>
              <div className="mock">
                <span className="out">$ ls ~/.claude/agents</span><br />
                developer.md<br />
                agent-architect.md<br />
                qa-runtime.md<span className="cursor"></span>
              </div>
            </div>

            <div className="step">
              <div className="num">02</div>
              <h3>Give them a desk. See them all at once.</h3>
              <p>
                Drag agents onto tiles in the isometric office floor. Each gets a desk, a status LED,
                and a live activity card. Three agents running at the same time - you see all three
                without switching context.
              </p>
              <div className="mock">
                <span className="out">developer</span> · running · Edit composer.tsx<br />
                <span className="out">agent-architect</span> · thinking<br />
                <span className="out">qa-runtime</span> · idle<span className="cursor"></span>
              </div>
            </div>

            <div className="step">
              <div className="num">03</div>
              <h3>Watch them work.</h3>
              <p>
                Output streams back in real time over SSE. Full transcripts and per-agent memory stored locally in SQLite.
                The office stays ambient - check in when you want to, not because you have to.
              </p>
              <div className="mock">
                <span className="out">developer · running</span><br />
                Edit · composer.tsx<br />
                <span className="prompt">▰▰▰▰▰▰▱▱▱</span> 62%<span className="cursor"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="section" id="features">
        <div className="section-inner">
          <div className="eyebrow">
            <span className="n">02</span>
            <span className="dash"></span>
            <span>What's inside</span>
          </div>
          <h2 className="bigtitle">
            Built for the
            <em>command-line crew.</em>
          </h2>
          <p className="lede">
            Every surface designed for builders who already think in terminals - but want
            an interface that respects their attention.
          </p>

          <div className="features">
            {/* The pixel island feature (tall) */}
            <div className="feature f-island tall">
              <div>
                <span className="label">The Office</span>
                <h4>A pixel floor your agents actually live on.</h4>
                <p>
                  Isometric workspace where each agent has a tile, a status LED, and live activity.
                  Drag agents between tiles, pan the floor, edit the layout. Peripheral awareness over constant attention.
                </p>
              </div>
              <img className="island-img" src="/office-floor.jpg" alt="Isometric pixel office floor" />
            </div>

            {/* No proprietary format */}
            <div className="feature f-terminal">
              <div>
                <span className="label">No lock-in</span>
                <h4>Plain .md files. No proprietary format.</h4>
                <div className="term">
                  <span className="prompt">›</span> cat ~/.claude/agents/developer.md<br />
                  <span className="mute"># developer</span><br />
                  <span className="ok">You are a senior full-stack…</span>
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className="feature f-heatmap">
              <div>
                <span className="label">Activity</span>
                <h4>Every run, every transcript. Yours forever.</h4>
              </div>
              <div className="heat">
                {/* 5 × 24 cells */}
                <div className="c"></div><div className="c l1"></div><div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c l2"></div><div className="c l3"></div><div className="c l4"></div><div className="c l3"></div><div className="c l2"></div><div className="c l1"></div><div className="c l1"></div><div className="c l2"></div><div className="c l3"></div><div className="c l4"></div><div className="c l3"></div><div className="c l4"></div><div className="c l2"></div><div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c l1"></div><div className="c"></div>
                <div className="c"></div><div className="c"></div><div className="c l1"></div><div className="c"></div><div className="c l1"></div><div className="c l1"></div><div className="c l2"></div><div className="c l3"></div><div className="c l2"></div><div className="c l4"></div><div className="c l3"></div><div className="c l2"></div><div className="c l4"></div><div className="c l2"></div><div className="c l3"></div><div className="c l2"></div><div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div>
                <div className="c"></div><div className="c"></div><div className="c"></div><div className="c l1"></div><div className="c"></div><div className="c l2"></div><div className="c l3"></div><div className="c l4"></div><div className="c l3"></div><div className="c l3"></div><div className="c l2"></div><div className="c l4"></div><div className="c l3"></div><div className="c l2"></div><div className="c l1"></div><div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div>
                <div className="c"></div><div className="c"></div><div className="c"></div><div className="c l1"></div><div className="c"></div><div className="c l1"></div><div className="c l2"></div><div className="c l2"></div><div className="c l3"></div><div className="c l4"></div><div className="c l4"></div><div className="c l3"></div><div className="c l2"></div><div className="c l1"></div><div className="c"></div><div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div>
                <div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c l1"></div><div className="c l2"></div><div className="c l3"></div><div className="c l3"></div><div className="c l4"></div><div className="c l3"></div><div className="c l2"></div><div className="c l2"></div><div className="c l1"></div><div className="c l1"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div><div className="c"></div>
              </div>
            </div>

            {/* Limits / spend tracking */}
            <div className="feature f-secure wide">
              <div>
                <span className="label">Spend tracking</span>
                <h4>Know what your agents are costing before it surprises you.</h4>
                <p>Per-session token usage visible in the sidebar. Set limits to stop runaway agents before they drain your budget.</p>
              </div>
              <div className="perms">
                <div className="perm"><span className="dot allow"></span>developer · $1.24 this session</div>
                <div className="perm"><span className="dot ask"></span>agent-architect · $3.17 this session</div>
                <div className="perm"><span className="dot deny"></span>Total · $5.41 · limit: $10.00</div>
              </div>
            </div>

            {/* Summon - full-width animated demo */}
            <div className="feature f-summon">
              <div className="summon-left">
                <span className="label">Summon</span>
                <h4>Prompt an agent.<br />Watch it work.</h4>
                <p>
                  Send any agent a task. Output streams back line by line - tool calls, edits,
                  reasoning - all stored in SQLite the moment the run ends.
                </p>
              </div>
              <div className="summon-right">
                <SummonDemo />
              </div>
            </div>

            {/* Roster - screenshot-ready background, component demo for now */}
            <div className="feature f-roster">
              <div>
                <span className="label">Roster</span>
                <h4>All your agents. One glance.</h4>
                <p>Cards view alongside the office floor - mixed states, all visible at once.</p>
              </div>
              <div className="roster-grid">
                <div className="r-card r-live">
                  <div className="r-head">
                    <div className="r-av"><img src="/avatars/12.png" alt="" /><span className="r-led on"></span></div>
                    <span className="r-name">developer</span>
                    <span className="r-chip run">running</span>
                  </div>
                  <div className="r-task">Edit · composer.tsx</div>
                  <div className="r-foot"><span className="r-pill">sonnet</span></div>
                </div>
                <div className="r-card r-live">
                  <div className="r-head">
                    <div className="r-av"><img src="/avatars/04.png" alt="" /><span className="r-led on"></span></div>
                    <span className="r-name">agent-architect</span>
                    <span className="r-chip think">thinking</span>
                  </div>
                  <div className="r-task">Drafting refusal rules…</div>
                  <div className="r-foot"><span className="r-pill">opus</span></div>
                </div>
                <div className="r-card">
                  <div className="r-head">
                    <div className="r-av"><img src="/avatars/07.png" alt="" /><span className="r-led"></span></div>
                    <span className="r-name">frontend-craftsman</span>
                    <span className="r-chip">idle</span>
                  </div>
                  <div className="r-task">Ready when you are</div>
                  <div className="r-foot"><span className="r-pill">sonnet</span></div>
                </div>
                <div className="r-card">
                  <div className="r-head">
                    <div className="r-av"><img src="/avatars/18.png" alt="" /><span className="r-led"></span></div>
                    <span className="r-name">qa-runtime</span>
                    <span className="r-chip">idle</span>
                  </div>
                  <div className="r-task">Last run: 1d ago</div>
                  <div className="r-foot"><span className="r-pill">sonnet</span></div>
                </div>
              </div>
            </div>

            {/* Projects */}
            <div className="feature f-projects">
              <div className="projects-left">
                <span className="label">Projects</span>
                <h4>Different project,<br />different roster.</h4>
                <p>
                  Scope a set of agents to each project. Switch projects and the office
                  reconfigures around your current context.
                </p>
              </div>
              <div className="project-list">
                <div className="project-row">
                  <span className="pr-dot active"></span>
                  <span className="pr-name">agent-office</span>
                  <span className="pr-count">6 agents</span>
                  <span className="pr-arrow">→</span>
                </div>
                <div className="project-row">
                  <span className="pr-dot"></span>
                  <span className="pr-name">landlord-os</span>
                  <span className="pr-count">3 agents</span>
                  <span className="pr-arrow">→</span>
                </div>
                <div className="project-row">
                  <span className="pr-dot"></span>
                  <span className="pr-name">trading-bot</span>
                  <span className="pr-count">4 agents</span>
                  <span className="pr-arrow">→</span>
                </div>
                <div className="project-row">
                  <span className="pr-dot"></span>
                  <span className="pr-name">+ new project</span>
                  <span className="pr-count"></span>
                  <span className="pr-arrow"></span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============ SPECS ============ */}
      <section className="specs" id="specs">
        <div className="specs-inner">
          <div className="cell">
            <div className="lbl">Built on</div>
            <div className="v">Claude Code <em>CLI</em></div>
            <div className="d">BYO Anthropic key · runs locally</div>
          </div>
          <div className="cell">
            <div className="lbl">Platforms</div>
            <div className="v" style={{ whiteSpace: 'nowrap' }}>Linux <em>· macOS · Win</em></div>
            <div className="d">Tauri 2 · Linux ships first</div>
          </div>
          <div className="cell">
            <div className="lbl">Storage</div>
            <div className="v"><em>Local-first</em> SQLite</div>
            <div className="d">Runs, transcripts, agent memory on-device</div>
          </div>
          <div className="cell">
            <div className="lbl">Pricing</div>
            <div className="v"><em>Free.</em> Full stop.</div>
            <div className="d">You pay Anthropic for tokens. That's it.</div>
          </div>
        </div>
      </section>

      {/* ============ BETA CTA ============ */}
      <section className="beta" id="beta">
        <div className="beta-inner">
          <span className="beta-tag">
            <span className="led"></span>
            Closed Beta · v0.1
          </span>

          <h2>
            Get on the list.
            <em>Skip the queue.</em>
          </h2>

          <p className="beta-sub">
            Agent Office is currently invite-only while we harden the runner and polish the office floor.
            Drop your email to claim a slot - Linux .deb and AppImage ship first, macOS and Windows follow.
          </p>

          <div className="tooltip-disabled tooltip-disabled-block" data-tooltip="Temporarily disabled">
            <form className="beta-form" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="your@email.com" required disabled />
              <button type="submit" disabled>Request Access</button>
            </form>
          </div>

          <div className="beta-platforms">
            <div className="item"><span>Linux .deb</span><span className="soon">SOON</span></div>
            <div className="item"><span>Linux AppImage</span><span className="soon">SOON</span></div>
            <div className="item"><span>macOS</span><span className="soon">AFTER</span></div>
            <div className="item"><span>Windows</span><span className="soon">AFTER</span></div>
            <div className="item"><span>Source</span><span className="ready">PUBLIC SOON</span></div>
          </div>


        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="section" id="faq">
        <div className="section-inner">
          <div className="eyebrow">
            <span className="n">03</span>
            <span className="dash"></span>
            <span>Frequently asked</span>
          </div>
          <h2 className="bigtitle">
            Things people
            <em>actually ask.</em>
          </h2>

          <div className="faq">
            <div className="q">
              <h5>What is agent orchestration?</h5>
              <p>Multiple Claude Code agents working on your codebase, each with their own role and prompt definition. Agent Office gives them a visual home and stores every run locally so nothing gets lost.</p>
            </div>
            <div className="q">
              <h5>Do I need an Anthropic API key?</h5>
              <p>Yes - Agent Office is BYOK. We never see or store your key; it stays on your machine and talks directly to Anthropic via the Claude Code CLI.</p>
            </div>
            <div className="q">
              <h5>How is this different from Cursor or Claude Code?</h5>
              <p>Claude Code is a terminal tool - powerful, but no persistent visual workspace. Agent Office gives your agents a home: roster management, per-agent memory, run history, project scoping, and an office floor that makes multi-agent work legible at a glance.</p>
            </div>
            <div className="q">
              <h5>Does this replace Claude Code?</h5>
              <p>No - it wraps it. Agent Office needs the Claude Code CLI installed and an Anthropic key configured. Think of it as a control room, not a replacement runtime.</p>
            </div>
            <div className="q">
              <h5>When can I download it?</h5>
              <p>Beta access is paused while we finalize the first release. Drop your email above and we'll send a download link the moment it opens.</p>
            </div>
            <div className="q">
              <h5>What does it cost?</h5>
              <p>The app is free and will stay free. You pay Anthropic for tokens. That's it.</p>
            </div>
            <div className="q">
              <h5>Is my code shared?</h5>
              <p>No. Runs, transcripts, and agent files all live locally in SQLite. Nothing leaves your machine except direct API calls to Anthropic.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <a className="brand" href="#">
              <span className="mark">O</span>
              <span>Agent Office</span>
            </a>
            <p className="tag">A desktop workspace for Claude Code agents. Runs locally, stores everything on-device, designed for the command-line crew.</p>
          </div>
          <div className="footer-col">
            <h6>Product</h6>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#specs">Specs</a>
            <a href="#beta">Beta access</a>
          </div>
          <div className="footer-col">
            <h6>Resources</h6>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>Documentation</a>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>Changelog</a>
            <a href="https://agent-orchestrator-landing.vercel.app/" target="_blank" rel="noreferrer">Case study</a>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>Roadmap</a>
          </div>
          <div className="footer-col">
            <h6>Connect</h6>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>GitHub</a>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>Discord</a>
            <a href="#" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' as const }}>X / Twitter</a>
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
