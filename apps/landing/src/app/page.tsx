'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import ScreenshotSlider from '../components/ScreenshotSlider';

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
    <div className="p-[16px_18px] bg-[#060404] rounded-[10px] border border-line-1 font-mono text-[12.5px] leading-[1.75] flex flex-col min-h-[210px]">
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
      <Nav activePage="home" />

      {/* ============ HERO ============ */}
      <header className="hero-grid relative pt-[180px] pb-[120px] px-8 overflow-hidden bg-[radial-gradient(ellipse_1100px_600px_at_50%_0%,rgba(233,84,32,0.10),transparent_70%),radial-gradient(ellipse_800px_400px_at_100%_100%,rgba(233,84,32,0.06),transparent_70%)] max-[760px]:pt-[130px] max-[760px]:pb-[80px] max-[760px]:px-[22px]">
        <div className="max-w-[var(--maxw)] mx-auto relative z-[2] text-center">
          <span className="inline-flex items-center gap-2.5 px-[8px] pr-[16px] py-[7px] bg-bg-2 border border-acc-tint rounded-full font-mono text-[11.5px] tracking-[0.16em] uppercase text-txt-2 mb-9">
            <span className="px-2.5 py-[3px] bg-acc text-[#1a0d05] rounded-full font-bold tracking-[0.16em]">v0.1</span>
            <span>Closed beta · invites rolling</span>
            <span className="text-acc">→</span>
          </span>

          <h1 className="m-0 font-sans font-extrabold text-[clamp(56px,7vw,108px)] leading-[0.86] tracking-[-0.04em]">
            Agents get desks.<br />
            <em className="not-italic text-acc">You get the view.</em>
          </h1>

          <p className="mt-8 mx-auto max-w-[720px] text-[22px] leading-[1.5] text-txt-2">
            Agent Office is a desktop app for managing Claude Code agents -{' '}
            <strong className="text-txt font-bold">roster them to a project, summon them with a prompt, watch output stream back in real time.</strong>{' '}
            Built for people who already run Claude Code and want a better view of what&apos;s happening.
          </p>

          <div className="mt-11 inline-flex gap-3 flex-wrap justify-center max-[760px]:flex-col max-[760px]:w-full">
            <span className="tooltip-disabled max-[760px]:w-full" data-tooltip="Temporarily disabled">
              <a href="#beta" className="inline-flex items-center gap-2.5 px-[26px] py-4 font-mono text-[13px] tracking-[0.16em] uppercase font-bold rounded-[10px] border border-transparent bg-acc text-[#1a0d05] transition-[transform,background] duration-[0.14s] hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--acc)_88%,white)] max-[760px]:w-full max-[760px]:justify-center">
                Request Beta Access <span className="text-[14px] text-[#1a0d05]">→</span>
              </a>
            </span>
            <a href="#how" className="inline-flex items-center gap-2.5 px-[26px] py-4 font-mono text-[13px] tracking-[0.16em] uppercase font-bold rounded-[10px] border border-line-2 bg-bg-2 text-txt transition-[transform,background,border-color] duration-[0.14s] hover:-translate-y-px hover:bg-bg-3 hover:border-txt-4">
              See how it works <span className="text-[14px] text-acc">↓</span>
            </a>
          </div>

          <div className="mt-7 font-mono text-[11px] tracking-[0.18em] uppercase text-txt-4 flex gap-[18px] items-center justify-center flex-wrap overflow-hidden max-[760px]:relative max-[760px]:[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex gap-[18px] items-center justify-center flex-wrap max-[760px]:flex-nowrap max-[760px]:justify-start max-[760px]:w-max max-[760px]:animate-marquee-fast max-[760px]:gap-6">
              <span>Linux · macOS · Windows</span>
              <span className="text-acc">·</span>
              <span>Linux ships first</span>
              <span className="text-acc">·</span>
              <span>BYO Anthropic key</span>
              <span className="hidden max-[760px]:inline">Linux · macOS · Windows</span>
              <span className="text-acc hidden max-[760px]:inline">·</span>
              <span className="hidden max-[760px]:inline">Linux ships first</span>
              <span className="text-acc hidden max-[760px]:inline">·</span>
              <span className="hidden max-[760px]:inline">BYO Anthropic key</span>
            </div>
          </div>
        </div>

        <div className="mt-16 relative z-[2]">
          <ScreenshotSlider />
        </div>
      </header>

      {/* ============ MARQUEE ============ */}
      <div className="marquee-wrap relative py-9 px-8 border-t border-b border-line-1 overflow-hidden">
        <div className="flex gap-16 items-center animate-marquee w-max font-mono text-[12px] tracking-[0.2em] uppercase text-txt-3">
          <span>Claude Code CLI</span><span className="text-acc">▪</span>
          <span>Ubuntu-Styled</span><span className="text-acc">▪</span>
          <span>Isometric Office UI</span><span className="text-acc">▪</span>
          <span>Tauri 2</span><span className="text-acc">▪</span>
          <span>BYOK Compatible</span><span className="text-acc">▪</span>
          <span>Agent Memory</span><span className="text-acc">▪</span>
          <span>Local SQLite</span><span className="text-acc">▪</span>
          <span>Run History</span><span className="text-acc">▪</span>
          <span>Claude Code CLI</span><span className="text-acc">▪</span>
          <span>Ubuntu-Styled</span><span className="text-acc">▪</span>
          <span>Isometric Office UI</span><span className="text-acc">▪</span>
          <span>Tauri 2</span><span className="text-acc">▪</span>
          <span>BYOK Compatible</span><span className="text-acc">▪</span>
          <span>Agent Memory</span><span className="text-acc">▪</span>
          <span>Local SQLite</span><span className="text-acc">▪</span>
          <span>Run History</span><span className="text-acc">▪</span>
        </div>
      </div>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative py-[120px] px-8 max-[760px]:py-[80px] max-[760px]:px-[22px]" id="how">
        <div className="max-w-[var(--maxw)] mx-auto relative">
          <div className="inline-flex items-center gap-3.5 font-mono text-[12px] tracking-[0.2em] uppercase text-acc font-bold">
            <span className="text-txt-3">01</span>
            <span className="w-7 h-px bg-acc"></span>
            <span>How it works</span>
          </div>
          <h2 className="mt-[22px] font-sans font-extrabold text-[clamp(48px,6.4vw,92px)] leading-[0.94] tracking-[-0.03em]">
            From CLI prompt
            <em className="italic text-acc block">to a running office.</em>
          </h2>
          <p className="max-w-[720px] mt-7 text-[19px] leading-[1.55] text-txt-2">
            Three steps. Set up once, then summon agents the way you&apos;d open a tab.
            Every step lives where you already work - no new tools to install beyond Claude Code.
          </p>

          <div className="mt-16 grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">
            <div className="relative p-7 bg-bg-1 border border-line-1 rounded-[14px] flex flex-col gap-3.5 transition-[transform,border-color] duration-[0.15s] hover:-translate-y-[3px] hover:border-acc-tint">
              <div className="font-sans italic font-extrabold text-[56px] leading-none text-acc tracking-[-0.02em]">01</div>
              <h3 className="m-0 font-sans font-bold text-[26px] tracking-[-0.01em]">Drop in your agents.</h3>
              <p className="m-0 text-txt-2 text-[15px] leading-[1.5]">
                Agent Office reads every <code className="font-mono text-acc text-[14px]">.md</code> file in <code className="font-mono text-txt text-[14px]">~/.claude/agents/</code> and builds your roster automatically. The same files Claude Code already reads - no new format, no migration.
              </p>
              <div className="mt-1.5 p-[12px_14px] bg-bg-2 border border-line-1 rounded-lg font-mono text-[12px] leading-[1.55] text-txt-2">
                <span className="text-txt-3">$ ls ~/.claude/agents</span><br />
                developer.md<br />
                agent-architect.md<br />
                qa-runtime.md<span className="inline-block w-1.5 h-3 bg-acc align-[-2px] ml-0.5 animate-cur"></span>
              </div>
            </div>

            <div className="relative p-7 bg-bg-1 border border-line-1 rounded-[14px] flex flex-col gap-3.5 transition-[transform,border-color] duration-[0.15s] hover:-translate-y-[3px] hover:border-acc-tint">
              <div className="font-sans italic font-extrabold text-[56px] leading-none text-acc tracking-[-0.02em]">02</div>
              <h3 className="m-0 font-sans font-bold text-[26px] tracking-[-0.01em]">Give them a desk. See them all at once.</h3>
              <p className="m-0 text-txt-2 text-[15px] leading-[1.5]">
                Drag agents onto tiles in the isometric office floor. Each gets a desk, a status LED,
                and a live activity card. Three agents running at the same time - you see all three
                without switching context.
              </p>
              <div className="mt-1.5 p-[12px_14px] bg-bg-2 border border-line-1 rounded-lg font-mono text-[12px] leading-[1.55] text-txt-2">
                <span className="text-txt-3">developer</span> · running · Edit composer.tsx<br />
                <span className="text-txt-3">agent-architect</span> · thinking<br />
                <span className="text-txt-3">qa-runtime</span> · idle<span className="inline-block w-1.5 h-3 bg-acc align-[-2px] ml-0.5 animate-cur"></span>
              </div>
            </div>

            <div className="relative p-7 bg-bg-1 border border-line-1 rounded-[14px] flex flex-col gap-3.5 transition-[transform,border-color] duration-[0.15s] hover:-translate-y-[3px] hover:border-acc-tint">
              <div className="font-sans italic font-extrabold text-[56px] leading-none text-acc tracking-[-0.02em]">03</div>
              <h3 className="m-0 font-sans font-bold text-[26px] tracking-[-0.01em]">Watch them work.</h3>
              <p className="m-0 text-txt-2 text-[15px] leading-[1.5]">
                Output streams back in real time over SSE. Full transcripts and per-agent memory stored locally in SQLite.
                The office stays ambient - check in when you want to, not because you have to.
              </p>
              <div className="mt-1.5 p-[12px_14px] bg-bg-2 border border-line-1 rounded-lg font-mono text-[12px] leading-[1.55] text-txt-2">
                <span className="text-txt-3">developer · running</span><br />
                Edit · composer.tsx<br />
                <span className="text-acc">▰▰▰▰▰▰▱▱▱</span> 62%<span className="inline-block w-1.5 h-3 bg-acc align-[-2px] ml-0.5 animate-cur"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative py-[120px] px-8 max-[760px]:py-[80px] max-[760px]:px-[22px]" id="features">
        <div className="max-w-[var(--maxw)] mx-auto relative">
          <div className="inline-flex items-center gap-3.5 font-mono text-[12px] tracking-[0.2em] uppercase text-acc font-bold">
            <span className="text-txt-3">02</span>
            <span className="w-7 h-px bg-acc"></span>
            <span>What&apos;s inside</span>
          </div>
          <h2 className="mt-[22px] font-sans font-extrabold text-[clamp(48px,6.4vw,92px)] leading-[0.94] tracking-[-0.03em]">
            Built for the
            <em className="italic text-acc block">command-line crew.</em>
          </h2>
          <p className="max-w-[720px] mt-7 text-[19px] leading-[1.55] text-txt-2">
            Every surface designed for builders who already think in terminals - but want
            an interface that respects their attention.
          </p>

          <div className="mt-16 grid gap-3 grid-cols-[2fr_1fr_1fr] auto-rows-[minmax(240px,auto)] max-[1080px]:grid-cols-2 max-[760px]:grid-cols-1">

            {/* The pixel island feature (tall) */}
            <div className="row-span-2 relative border border-line-1 bg-bg-1 rounded-[14px] p-6 overflow-hidden flex flex-col justify-between max-[1080px]:row-span-1 max-[760px]:min-h-[360px]">
              <div className="island-overlay relative z-[1]">
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-acc inline-flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-acc before:block">The Office</span>
                <h4 className="mt-2.5 font-sans font-bold text-[28px] leading-[1.05] tracking-[-0.015em] max-w-[320px]">A pixel floor your agents actually live on.</h4>
                <p className="mt-3 text-[14px] leading-[1.5] text-txt-3 max-w-[320px]">
                  Isometric workspace where each agent has a tile, a status LED, and live activity.
                  Drag agents between tiles, pan the floor, edit the layout. Peripheral awareness over constant attention.
                </p>
              </div>
              <img className="absolute inset-0 w-full h-full object-cover object-center z-0" src="/office-floor.jpg" alt="Isometric pixel office floor" />
            </div>

            {/* No proprietary format */}
            <div className="relative border border-line-1 rounded-[14px] p-6 overflow-hidden flex flex-col justify-between bg-[linear-gradient(180deg,rgba(233,84,32,0.04),transparent_60%),var(--bg-1)]">
              <div>
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-acc inline-flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-acc before:block">No lock-in</span>
                <h4 className="mt-2.5 font-sans font-bold text-[28px] leading-[1.05] tracking-[-0.015em] max-w-[320px]">Plain .md files. No proprietary format.</h4>
                <div className="mt-3.5 p-3 bg-[#0a0807] rounded-lg border border-line-1 font-mono text-[11.5px] leading-[1.6] text-txt-2">
                  <span className="text-acc">›</span> cat ~/.claude/agents/developer.md<br />
                  <span className="text-txt-4"># developer</span><br />
                  <span className="text-ok">You are a senior full-stack…</span>
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className="relative border border-line-1 bg-bg-1 rounded-[14px] p-6 overflow-hidden flex flex-col justify-between">
              <div>
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-acc inline-flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-acc before:block">Activity</span>
                <h4 className="mt-2.5 font-sans font-bold text-[28px] leading-[1.05] tracking-[-0.015em] max-w-[320px]">Every run, every transcript. Yours forever.</h4>
              </div>
              <div className="grid grid-cols-[repeat(24,1fr)] grid-rows-[repeat(5,1fr)] gap-0.5 h-[100px] mt-3.5">
                <div className="hc"></div><div className="hc hc-1"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc hc-2"></div><div className="hc hc-3"></div><div className="hc hc-4"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-1"></div><div className="hc hc-1"></div><div className="hc hc-2"></div><div className="hc hc-3"></div><div className="hc hc-4"></div><div className="hc hc-3"></div><div className="hc hc-4"></div><div className="hc hc-2"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc"></div>
                <div className="hc"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc hc-1"></div><div className="hc hc-2"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-4"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-4"></div><div className="hc hc-2"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div>
                <div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc hc-2"></div><div className="hc hc-3"></div><div className="hc hc-4"></div><div className="hc hc-3"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-4"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-1"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div>
                <div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc hc-2"></div><div className="hc hc-2"></div><div className="hc hc-3"></div><div className="hc hc-4"></div><div className="hc hc-4"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div>
                <div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc hc-1"></div><div className="hc hc-2"></div><div className="hc hc-3"></div><div className="hc hc-3"></div><div className="hc hc-4"></div><div className="hc hc-3"></div><div className="hc hc-2"></div><div className="hc hc-2"></div><div className="hc hc-1"></div><div className="hc hc-1"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div><div className="hc"></div>
              </div>
            </div>

            {/* Limits / spend tracking (wide) */}
            <div className="col-span-2 relative border border-line-1 bg-bg-1 rounded-[14px] p-6 overflow-hidden flex flex-row items-center gap-10 max-[1080px]:flex-col max-[1080px]:items-start max-[760px]:col-span-1">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-acc inline-flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-acc before:block">Spend tracking</span>
                <h4 className="mt-2.5 font-sans font-bold text-[28px] leading-[1.05] tracking-[-0.015em] max-w-[320px]">Know what your agents are costing before it surprises you.</h4>
                <p className="mt-3 text-[14px] leading-[1.5] text-txt-3 max-w-[320px]">Per-session token usage visible in the sidebar. Set limits to stop runaway agents before they drain your budget.</p>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-mono text-[11px] text-txt-2">
                  <span className="w-[7px] h-[7px] rounded-full bg-ok flex-shrink-0"></span>
                  developer · $1.24 this session
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-txt-2">
                  <span className="w-[7px] h-[7px] rounded-full bg-[#e6b35a] flex-shrink-0"></span>
                  agent-architect · $3.17 this session
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-txt-2">
                  <span className="w-[7px] h-[7px] rounded-full bg-[#d9534f] flex-shrink-0"></span>
                  Total · $5.41 · limit: $10.00
                </div>
              </div>
            </div>

            {/* Summon - full-width animated demo */}
            <div className="col-span-3 relative border border-line-1 rounded-[14px] p-6 overflow-hidden flex flex-row items-center gap-[52px] bg-[radial-gradient(ellipse_55%_90%_at_85%_50%,rgba(233,84,32,0.07),transparent_60%),var(--bg-1)] max-[1080px]:col-span-2 max-[1080px]:flex-col max-[1080px]:gap-6 max-[760px]:col-span-1">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-acc inline-flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-acc before:block">Summon</span>
                <h4 className="mt-2.5 font-sans font-bold text-[28px] leading-[1.05] tracking-[-0.015em] max-w-[320px]">Prompt an agent.<br />Watch it work.</h4>
                <p className="mt-3 text-[14px] leading-[1.5] text-txt-3 max-w-[320px]">
                  Send any agent a task. Output streams back line by line - tool calls, edits,
                  reasoning - all stored in SQLite the moment the run ends.
                </p>
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <SummonDemo />
              </div>
            </div>

            {/* Roster */}
            <div className="col-start-1 row-span-2 relative border border-line-1 rounded-[14px] p-6 overflow-hidden flex flex-col justify-start bg-[radial-gradient(ellipse_80%_50%_at_50%_110%,rgba(233,84,32,0.06),transparent_70%),var(--bg-1)] max-[1080px]:row-span-1">
              <div>
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-acc inline-flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-acc before:block">Roster</span>
                <h4 className="mt-2.5 font-sans font-bold text-[28px] leading-[1.05] tracking-[-0.015em] max-w-[320px]">All your agents. One glance.</h4>
                <p className="mt-3 text-[14px] leading-[1.5] text-txt-3 max-w-[320px]">Cards view alongside the office floor - mixed states, all visible at once.</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-[7px] max-[760px]:grid-cols-1">
                <div className="p-[9px_11px] bg-bg-2 border border-acc-tint rounded-lg flex flex-col gap-[5px]">
                  <div className="flex items-center gap-[7px]">
                    <div className="relative w-7 h-7 flex-shrink-0">
                      <img src="/avatars/12.png" alt="" className="w-7 h-7 object-contain [image-rendering:pixelated]" />
                      <span className="absolute bottom-[-1px] right-[-2px] w-1.5 h-1.5 rounded-full bg-ok shadow-[0_0_5px_var(--ok)]"></span>
                    </div>
                    <span className="font-mono text-[10.5px] text-txt-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">developer</span>
                    <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-[rgba(78,185,111,0.12)] text-ok">running</span>
                  </div>
                  <div className="text-[10.5px] text-txt-4 font-mono whitespace-nowrap overflow-hidden text-ellipsis">Edit · composer.tsx</div>
                  <div className="flex gap-1"><span className="font-mono text-[9.5px] px-[5px] py-px bg-bg-3 rounded text-txt-4">sonnet</span></div>
                </div>
                <div className="p-[9px_11px] bg-bg-2 border border-acc-tint rounded-lg flex flex-col gap-[5px]">
                  <div className="flex items-center gap-[7px]">
                    <div className="relative w-7 h-7 flex-shrink-0">
                      <img src="/avatars/04.png" alt="" className="w-7 h-7 object-contain [image-rendering:pixelated]" />
                      <span className="absolute bottom-[-1px] right-[-2px] w-1.5 h-1.5 rounded-full bg-ok shadow-[0_0_5px_var(--ok)]"></span>
                    </div>
                    <span className="font-mono text-[10.5px] text-txt-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">agent-architect</span>
                    <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-[rgba(233,84,32,0.12)] text-acc">thinking</span>
                  </div>
                  <div className="text-[10.5px] text-txt-4 font-mono whitespace-nowrap overflow-hidden text-ellipsis">Drafting refusal rules…</div>
                  <div className="flex gap-1"><span className="font-mono text-[9.5px] px-[5px] py-px bg-bg-3 rounded text-txt-4">opus</span></div>
                </div>
                <div className="p-[9px_11px] bg-bg-2 border border-line-1 rounded-lg flex flex-col gap-[5px]">
                  <div className="flex items-center gap-[7px]">
                    <div className="relative w-7 h-7 flex-shrink-0">
                      <img src="/avatars/07.png" alt="" className="w-7 h-7 object-contain [image-rendering:pixelated]" />
                      <span className="absolute bottom-[-1px] right-[-2px] w-1.5 h-1.5 rounded-full bg-[var(--txt-4)]"></span>
                    </div>
                    <span className="font-mono text-[10.5px] text-txt-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">frontend-craftsman</span>
                    <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-bg-3 text-txt-4">idle</span>
                  </div>
                  <div className="text-[10.5px] text-txt-4 font-mono whitespace-nowrap overflow-hidden text-ellipsis">Ready when you are</div>
                  <div className="flex gap-1"><span className="font-mono text-[9.5px] px-[5px] py-px bg-bg-3 rounded text-txt-4">sonnet</span></div>
                </div>
                <div className="p-[9px_11px] bg-bg-2 border border-line-1 rounded-lg flex flex-col gap-[5px]">
                  <div className="flex items-center gap-[7px]">
                    <div className="relative w-7 h-7 flex-shrink-0">
                      <img src="/avatars/18.png" alt="" className="w-7 h-7 object-contain [image-rendering:pixelated]" />
                      <span className="absolute bottom-[-1px] right-[-2px] w-1.5 h-1.5 rounded-full bg-[var(--txt-4)]"></span>
                    </div>
                    <span className="font-mono text-[10.5px] text-txt-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">qa-runtime</span>
                    <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-bg-3 text-txt-4">idle</span>
                  </div>
                  <div className="text-[10.5px] text-txt-4 font-mono whitespace-nowrap overflow-hidden text-ellipsis">Last run: 1d ago</div>
                  <div className="flex gap-1"><span className="font-mono text-[9.5px] px-[5px] py-px bg-bg-3 rounded text-txt-4">sonnet</span></div>
                </div>
              </div>
            </div>

            {/* Projects */}
            <div className="col-span-2 relative border border-line-1 bg-bg-1 rounded-[14px] p-6 overflow-hidden flex flex-row items-start gap-10 max-[760px]:col-span-1 max-[760px]:flex-col">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-acc inline-flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-acc before:block">Projects</span>
                <h4 className="mt-2.5 font-sans font-bold text-[28px] leading-[1.05] tracking-[-0.015em] max-w-[320px]">Different project,<br />different roster.</h4>
                <p className="mt-3 text-[14px] leading-[1.5] text-txt-3 max-w-[320px]">
                  Scope a set of agents to each project. Switch projects and the office
                  reconfigures around your current context.
                </p>
              </div>
              <div className="mt-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-2 border border-line-1 rounded-lg font-mono text-[11.5px] transition-[border-color] duration-[0.12s] hover:border-line-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok shadow-[0_0_6px_var(--ok)] flex-shrink-0"></span>
                  <span className="flex-1 text-txt">agent-office</span>
                  <span className="text-txt-4 text-[11px]">6 agents</span>
                  <span className="text-txt-4 text-[11px] ml-1">→</span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-2 border border-line-1 rounded-lg font-mono text-[11.5px] transition-[border-color] duration-[0.12s] hover:border-line-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-txt-4 flex-shrink-0"></span>
                  <span className="flex-1 text-txt">landlord-os</span>
                  <span className="text-txt-4 text-[11px]">3 agents</span>
                  <span className="text-txt-4 text-[11px] ml-1">→</span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-2 border border-line-1 rounded-lg font-mono text-[11.5px] transition-[border-color] duration-[0.12s] hover:border-line-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-txt-4 flex-shrink-0"></span>
                  <span className="flex-1 text-txt">trading-bot</span>
                  <span className="text-txt-4 text-[11px]">4 agents</span>
                  <span className="text-txt-4 text-[11px] ml-1">→</span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-2 border border-line-1 rounded-lg font-mono text-[11.5px] transition-[border-color] duration-[0.12s] hover:border-line-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-txt-4 flex-shrink-0"></span>
                  <span className="flex-1 text-txt">+ new project</span>
                  <span className="text-txt-4 text-[11px]"></span>
                  <span className="text-txt-4 text-[11px] ml-1"></span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============ SPECS ============ */}
      <section className="py-[80px] px-8 border-t border-b border-line-1" id="specs">
        <div className="max-w-[var(--maxw)] mx-auto grid grid-cols-4 gap-6 max-[1080px]:grid-cols-2 max-[760px]:grid-cols-1">
          <div className="pr-6 border-r border-line-1 max-[1080px]:border-r-0 max-[760px]:border-b max-[760px]:border-line-1 max-[760px]:pb-6">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-txt-4">Built on</div>
            <div className="mt-2.5 font-sans font-bold text-[32px] tracking-[-0.015em] text-txt">Claude Code <em className="text-acc italic font-extrabold">CLI</em></div>
            <div className="mt-1.5 font-mono text-[11px] text-txt-3">BYO Anthropic key · runs locally</div>
          </div>
          <div className="pr-6 border-r border-line-1 max-[1080px]:border-r-0 max-[760px]:border-b max-[760px]:border-line-1 max-[760px]:pb-6">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-txt-4">Platforms</div>
            <div className="mt-2.5 font-sans font-bold text-[32px] tracking-[-0.015em] text-txt whitespace-nowrap">Linux <em className="text-acc italic font-extrabold">· macOS · Win</em></div>
            <div className="mt-1.5 font-mono text-[11px] text-txt-3">Tauri 2 · Linux ships first</div>
          </div>
          <div className="pr-6 border-r border-line-1 max-[1080px]:border-r-0 max-[760px]:border-b max-[760px]:border-line-1 max-[760px]:pb-6">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-txt-4">Storage</div>
            <div className="mt-2.5 font-sans font-bold text-[32px] tracking-[-0.015em] text-txt"><em className="text-acc italic font-extrabold">Local-first</em> SQLite</div>
            <div className="mt-1.5 font-mono text-[11px] text-txt-3">Runs, transcripts, agent memory on-device</div>
          </div>
          <div className="pr-6 max-[760px]:border-0">
            <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-txt-4">Pricing</div>
            <div className="mt-2.5 font-sans font-bold text-[32px] tracking-[-0.015em] text-txt"><em className="text-acc italic font-extrabold">Free.</em> Full stop.</div>
            <div className="mt-1.5 font-mono text-[11px] text-txt-3">You pay Anthropic for tokens. That&apos;s it.</div>
          </div>
        </div>
      </section>

      {/* ============ BETA CTA ============ */}
      <section className="beta-glow relative pt-[140px] pb-[140px] px-8 overflow-hidden" id="beta">
        <div className="max-w-[860px] mx-auto text-center relative">
          <span className="inline-flex items-center gap-2.5 px-4 py-[7px] border border-acc-tint rounded-full bg-acc-faint font-mono text-[11.5px] tracking-[0.2em] uppercase font-bold text-acc mb-9">
            <span className="w-[7px] h-[7px] rounded-full bg-acc shadow-[0_0_8px_var(--acc)] animate-pulse-led"></span>
            Closed Beta · v0.1
          </span>
          <h2 className="m-0 font-sans font-extrabold text-[clamp(56px,7.5vw,108px)] leading-[0.9] tracking-[-0.03em]">
            Get on the list.
            <em className="italic text-acc block">Skip the queue.</em>
          </h2>
          <p className="mt-7 mb-11 mx-auto max-w-[620px] text-[18px] leading-[1.55] text-txt-2">
            Agent Office is currently invite-only while we harden the runner and polish the office floor.
            Drop your email to claim a slot - Linux .deb and AppImage ship first, macOS and Windows follow.
          </p>
          <div className="tooltip-disabled block" data-tooltip="Temporarily disabled">
            <form className="flex gap-2.5 max-w-[540px] mx-auto p-[8px_8px_8px_18px] bg-bg-2 border border-line-2 rounded-[14px] transition-[border-color,box-shadow] duration-[0.15s] focus-within:border-acc focus-within:shadow-[0_0_0_4px_var(--acc-softer)]" onSubmit={e => e.preventDefault()}>
              <input type="email" placeholder="your@email.com" required disabled className="flex-1 bg-transparent border-0 outline-none text-txt font-mono text-[14px] py-3.5 placeholder:text-txt-4" />
              <button type="submit" disabled className="px-[22px] py-3 bg-acc text-[#1a0d05] rounded-lg font-mono text-[12px] font-bold tracking-[0.18em] uppercase hover:bg-[color-mix(in_oklab,var(--acc)_88%,white)]">Request Access</button>
            </form>
          </div>
          <div className="mt-10 flex gap-7 justify-center flex-wrap font-mono text-[11px] tracking-[0.18em] uppercase text-txt-4">
            <div className="flex items-center gap-2"><span>Linux .deb</span><span className="px-2 py-0.5 border border-line-2 rounded text-txt-3 tracking-[0.14em]">SOON</span></div>
            <div className="flex items-center gap-2"><span>Linux AppImage</span><span className="px-2 py-0.5 border border-line-2 rounded text-txt-3 tracking-[0.14em]">SOON</span></div>
            <div className="flex items-center gap-2"><span>macOS</span><span className="px-2 py-0.5 border border-line-2 rounded text-txt-3 tracking-[0.14em]">AFTER</span></div>
            <div className="flex items-center gap-2"><span>Windows</span><span className="px-2 py-0.5 border border-line-2 rounded text-txt-3 tracking-[0.14em]">AFTER</span></div>
            <div className="flex items-center gap-2"><span>Source</span><span className="px-2 py-0.5 bg-acc-faint border border-acc-tint text-acc rounded tracking-[0.14em]">PUBLIC SOON</span></div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="relative py-[120px] px-8 max-[760px]:py-[80px] max-[760px]:px-[22px]" id="faq">
        <div className="max-w-[var(--maxw)] mx-auto relative">
          <div className="inline-flex items-center gap-3.5 font-mono text-[12px] tracking-[0.2em] uppercase text-acc font-bold">
            <span className="text-txt-3">03</span>
            <span className="w-7 h-px bg-acc"></span>
            <span>Frequently asked</span>
          </div>
          <h2 className="mt-[22px] font-sans font-extrabold text-[clamp(48px,6.4vw,92px)] leading-[0.94] tracking-[-0.03em]">
            Things people
            <em className="italic text-acc block">actually ask.</em>
          </h2>

          <div className="mt-14 grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
            <div className="p-[22px_24px] bg-bg-1 border border-line-1 rounded-xl">
              <h5 className="m-0 mb-2.5 font-sans font-bold text-[18px] tracking-[-0.01em] flex items-center gap-2.5 before:content-['?'] before:w-[22px] before:h-[22px] before:grid before:place-items-center before:bg-acc-faint before:text-acc before:border before:border-acc-tint before:rounded-md before:font-mono before:font-bold before:text-[13px] before:flex-shrink-0">
                What is agent orchestration?
              </h5>
              <p className="m-0 text-[14px] leading-[1.55] text-txt-3">Multiple Claude Code agents working on your codebase, each with their own role and prompt definition. Agent Office gives them a visual home and stores every run locally so nothing gets lost.</p>
            </div>
            <div className="p-[22px_24px] bg-bg-1 border border-line-1 rounded-xl">
              <h5 className="m-0 mb-2.5 font-sans font-bold text-[18px] tracking-[-0.01em] flex items-center gap-2.5 before:content-['?'] before:w-[22px] before:h-[22px] before:grid before:place-items-center before:bg-acc-faint before:text-acc before:border before:border-acc-tint before:rounded-md before:font-mono before:font-bold before:text-[13px] before:flex-shrink-0">
                Do I need an Anthropic API key?
              </h5>
              <p className="m-0 text-[14px] leading-[1.55] text-txt-3">Yes - Agent Office is BYOK. We never see or store your key; it stays on your machine and talks directly to Anthropic via the Claude Code CLI.</p>
            </div>
            <div className="p-[22px_24px] bg-bg-1 border border-line-1 rounded-xl">
              <h5 className="m-0 mb-2.5 font-sans font-bold text-[18px] tracking-[-0.01em] flex items-center gap-2.5 before:content-['?'] before:w-[22px] before:h-[22px] before:grid before:place-items-center before:bg-acc-faint before:text-acc before:border before:border-acc-tint before:rounded-md before:font-mono before:font-bold before:text-[13px] before:flex-shrink-0">
                How is this different from Cursor or Claude Code?
              </h5>
              <p className="m-0 text-[14px] leading-[1.55] text-txt-3">Claude Code is a terminal tool - powerful, but no persistent visual workspace. Agent Office gives your agents a home: roster management, per-agent memory, run history, project scoping, and an office floor that makes multi-agent work legible at a glance.</p>
            </div>
            <div className="p-[22px_24px] bg-bg-1 border border-line-1 rounded-xl">
              <h5 className="m-0 mb-2.5 font-sans font-bold text-[18px] tracking-[-0.01em] flex items-center gap-2.5 before:content-['?'] before:w-[22px] before:h-[22px] before:grid before:place-items-center before:bg-acc-faint before:text-acc before:border before:border-acc-tint before:rounded-md before:font-mono before:font-bold before:text-[13px] before:flex-shrink-0">
                Does this replace Claude Code?
              </h5>
              <p className="m-0 text-[14px] leading-[1.55] text-txt-3">No - it wraps it. Agent Office needs the Claude Code CLI installed and an Anthropic key configured. Think of it as a control room, not a replacement runtime.</p>
            </div>
            <div className="p-[22px_24px] bg-bg-1 border border-line-1 rounded-xl">
              <h5 className="m-0 mb-2.5 font-sans font-bold text-[18px] tracking-[-0.01em] flex items-center gap-2.5 before:content-['?'] before:w-[22px] before:h-[22px] before:grid before:place-items-center before:bg-acc-faint before:text-acc before:border before:border-acc-tint before:rounded-md before:font-mono before:font-bold before:text-[13px] before:flex-shrink-0">
                When can I download it?
              </h5>
              <p className="m-0 text-[14px] leading-[1.55] text-txt-3">Beta access is paused while we finalize the first release. Drop your email above and we&apos;ll send a download link the moment it opens.</p>
            </div>
            <div className="p-[22px_24px] bg-bg-1 border border-line-1 rounded-xl">
              <h5 className="m-0 mb-2.5 font-sans font-bold text-[18px] tracking-[-0.01em] flex items-center gap-2.5 before:content-['?'] before:w-[22px] before:h-[22px] before:grid before:place-items-center before:bg-acc-faint before:text-acc before:border before:border-acc-tint before:rounded-md before:font-mono before:font-bold before:text-[13px] before:flex-shrink-0">
                What does it cost?
              </h5>
              <p className="m-0 text-[14px] leading-[1.55] text-txt-3">The app is free and will stay free. You pay Anthropic for tokens. That&apos;s it.</p>
            </div>
            <div className="p-[22px_24px] bg-bg-1 border border-line-1 rounded-xl">
              <h5 className="m-0 mb-2.5 font-sans font-bold text-[18px] tracking-[-0.01em] flex items-center gap-2.5 before:content-['?'] before:w-[22px] before:h-[22px] before:grid before:place-items-center before:bg-acc-faint before:text-acc before:border before:border-acc-tint before:rounded-md before:font-mono before:font-bold before:text-[13px] before:flex-shrink-0">
                Is my code shared?
              </h5>
              <p className="m-0 text-[14px] leading-[1.55] text-txt-3">No. Runs, transcripts, and agent files all live locally in SQLite. Nothing leaves your machine except direct API calls to Anthropic.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="pt-[60px] pb-[60px] px-8 border-t border-line-1 bg-bg-0">
        <div className="max-w-[var(--maxw)] mx-auto grid grid-cols-[2fr_1fr_1fr_1fr] gap-10 max-[760px]:grid-cols-2">
          <div>
            <a className="inline-flex items-center gap-2.5 font-mono font-bold text-[12px] tracking-[0.18em] uppercase" href="#">
              <span className="w-[22px] h-[22px] bg-acc grid place-items-center font-sans font-extrabold text-[13px] text-[#1a0d05]">O</span>
              Agent Office
            </a>
            <p className="mt-3.5 max-w-[320px] text-[13px] text-txt-3 leading-[1.5]">A desktop workspace for Claude Code agents. Runs locally, stores everything on-device, designed for the command-line crew.</p>
          </div>
          <div>
            <h6 className="m-0 mb-3.5 font-mono text-[11px] tracking-[0.18em] uppercase text-txt-4">Product</h6>
            <a className="block py-1 text-[13px] text-txt-2 hover:text-acc transition-colors" href="#how">How it works</a>
            <a className="block py-1 text-[13px] text-txt-2 hover:text-acc transition-colors" href="#features">Features</a>
            <a className="block py-1 text-[13px] text-txt-2 hover:text-acc transition-colors" href="#specs">Specs</a>
            <a className="block py-1 text-[13px] text-txt-2 hover:text-acc transition-colors" href="#beta">Beta access</a>
          </div>
          <div>
            <h6 className="m-0 mb-3.5 font-mono text-[11px] tracking-[0.18em] uppercase text-txt-4">Resources</h6>
            <a className="block py-1 text-[13px] text-txt-2 opacity-35 cursor-default pointer-events-none" href="#" aria-disabled="true">Changelog</a>
            <a className="block py-1 text-[13px] text-txt-2 hover:text-acc transition-colors" href="https://agent-orchestrator-landing.vercel.app/" target="_blank" rel="noreferrer">Case study</a>
            <a className="block py-1 text-[13px] text-txt-2 opacity-35 cursor-default pointer-events-none" href="#" aria-disabled="true">Roadmap</a>
          </div>
          <div>
            <h6 className="m-0 mb-3.5 font-mono text-[11px] tracking-[0.18em] uppercase text-txt-4">Connect</h6>
            <a className="block py-1 text-[13px] text-txt-2 opacity-35 cursor-default pointer-events-none" href="#" aria-disabled="true">GitHub</a>
            <a className="block py-1 text-[13px] text-txt-2 opacity-35 cursor-default pointer-events-none" href="#" aria-disabled="true">Discord</a>
            <a className="block py-1 text-[13px] text-txt-2 opacity-35 cursor-default pointer-events-none" href="#" aria-disabled="true">X / Twitter</a>
            <a className="block py-1 text-[13px] text-txt-2 hover:text-acc transition-colors" href="mailto:hello.arturas.miceika@gmail.com">Email</a>
          </div>
        </div>
        <div className="max-w-[var(--maxw)] mx-auto mt-10 pt-6 border-t border-line-1 flex justify-between items-center font-mono text-[11px] tracking-[0.14em] uppercase text-txt-4 max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:text-center">
          <span>© 2026 AGENT OFFICE · <span className="text-acc">CLOSED BETA</span></span>
          <span>BUILT IN THE TERMINAL · SHIPPED ON THE DESKTOP</span>
        </div>
      </footer>

    </>
  );
}
