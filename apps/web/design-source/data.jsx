// data.jsx — mock fleet, runs, skills

const SKILLS = [
  "research", "code-review", "qa-web", "qa-app", "scraping",
  "docs", "refactor", "perf", "security", "devops",
  "design", "data", "ml", "test-gen", "i18n",
];

const TOOLS = [
  "Read", "Write", "Edit", "Bash", "WebFetch", "WebSearch",
  "Computer", "MCP:postgres", "MCP:github", "MCP:linear",
];

// Carefully tuned roster — 18 hand-named, then auto-fill to 50 for stress test
const HAND_AGENTS = [
  { id: "atlas",    name: "Atlas",    glyph: "🗺", desc: "Plans multi-step research across the open web; produces structured briefs with citations.",
    skills: ["research", "docs"], tools: ["WebSearch","WebFetch","Read","Write"], model: "opus", effort: "high",
    status: "working", pm: "ask", lastRunMs: 1.2*60_000 },
  { id: "felix",    name: "Felix",    glyph: "🔍", desc: "Reviews diffs for correctness, style and risk. Suggests fixes inline. Quiet on uncontroversial changes.",
    skills: ["code-review", "refactor"], tools: ["Read","Edit","Bash"], model: "sonnet", effort: "high",
    status: "idle", pm: "ask" },
  { id: "maya",     name: "Maya",     glyph: "🕷", desc: "Drives a real browser to QA web flows — fills forms, asserts UI states, files repros with screenshots.",
    skills: ["qa-web","test-gen"], tools: ["Computer","WebFetch","Read","Write"], model: "sonnet", effort: "medium",
    status: "working", pm: "auto", lastRunMs: 7.4*60_000 },
  { id: "mori",     name: "Mori",     glyph: "🐚", desc: "Surveys research papers, blogs, and changelogs for a given topic; deduplicates and synthesizes findings.",
    skills: ["research","ml"], tools: ["WebSearch","WebFetch","Read"], model: "opus", effort: "high",
    status: "done", pm: "ask" },
  { id: "ren",      name: "Ren",      glyph: "✂", desc: "Refactors a focused area of the codebase into smaller, named units. Preserves behavior; updates callers.",
    skills: ["refactor","code-review"], tools: ["Read","Edit","Bash"], model: "sonnet", effort: "medium",
    status: "idle", pm: "ask" },
  { id: "scribe",   name: "Scribe",   glyph: "✎", desc: "Writes and updates docs from source. Generates README, API references, ADRs, migration notes.",
    skills: ["docs"], tools: ["Read","Write","Edit"], model: "haiku", effort: "low",
    status: "idle", pm: "auto" },
  { id: "sentry",   name: "Sentry",   glyph: "⛨", desc: "Audits dependencies, secrets, and IAM for known risks. Outputs a prioritized fix list with diffs.",
    skills: ["security","devops"], tools: ["Read","Bash","WebFetch"], model: "opus", effort: "high",
    status: "error", pm: "ask" },
  { id: "harvest",  name: "Harvest",  glyph: "🜨", desc: "Scrapes and normalizes structured data from heterogeneous sources. Idempotent; resumes on failure.",
    skills: ["scraping","data"], tools: ["WebFetch","Computer","Write"], model: "sonnet", effort: "medium",
    status: "queued", pm: "auto" },
  { id: "vela",     name: "Vela",     glyph: "▲", desc: "Profiles hot paths, finds wins, ships measured perf PRs. Defaults to micro-benchmarks before changes.",
    skills: ["perf","refactor"], tools: ["Read","Edit","Bash"], model: "sonnet", effort: "high",
    status: "idle", pm: "ask" },
  { id: "iris",     name: "Iris",     glyph: "✦", desc: "Generates UI variants from a brief and existing design tokens. Outputs JSX + screenshots.",
    skills: ["design"], tools: ["Read","Write"], model: "sonnet", effort: "medium",
    status: "done", pm: "auto" },
  { id: "muse",     name: "Muse",     glyph: "♬", desc: "Writes targeted unit tests, expands coverage of given files, refactors brittle tests into table form.",
    skills: ["test-gen","qa-app"], tools: ["Read","Edit","Bash"], model: "haiku", effort: "medium",
    status: "idle", pm: "auto" },
  { id: "polyglot", name: "Polyglot", glyph: "✺", desc: "Adds locales to UI strings, audits hardcoded copy, writes ICU-formatted message catalogs.",
    skills: ["i18n","docs"], tools: ["Read","Edit","Write"], model: "haiku", effort: "low",
    status: "idle", pm: "auto" },
  { id: "boreal",   name: "Boreal",   glyph: "❄", desc: "Cold-starts new repos with conventional layouts, CI, lint, prettier, vitest.",
    skills: ["devops","docs"], tools: ["Read","Write","Bash"], model: "haiku", effort: "low",
    status: "idle", pm: "auto" },
  { id: "lumen",    name: "Lumen",    glyph: "☀", desc: "Visualizes datasets — picks chart types, generates interactive HTML with notes about caveats.",
    skills: ["data","design"], tools: ["Read","Write"], model: "sonnet", effort: "medium",
    status: "idle", pm: "auto" },
  { id: "auger",    name: "Auger",    glyph: "↯", desc: "Runs targeted ML experiments end-to-end: dataset → train → eval → report. Resumes from checkpoints.",
    skills: ["ml","data"], tools: ["Read","Write","Bash"], model: "opus", effort: "high",
    status: "idle", pm: "ask" },
  { id: "halcyon",  name: "Halcyon",  glyph: "◐", desc: "Triages bug reports — reproduces, isolates, files actionable issues with stack + repro steps.",
    skills: ["qa-app","qa-web"], tools: ["Read","Bash","Computer"], model: "sonnet", effort: "medium",
    status: "idle", pm: "auto" },
  { id: "orchid",   name: "Orchid",   glyph: "❀", desc: "Reviews UX writing — labels, errors, empty states. Tightens copy to product voice.",
    skills: ["docs","design"], tools: ["Read","Edit"], model: "haiku", effort: "low",
    status: "done", pm: "auto" },
  { id: "arc",      name: "Arc",      glyph: "↗", desc: "Plans and executes migrations: framework upgrades, dep bumps, API surface changes. Runs incremental.",
    skills: ["refactor","devops"], tools: ["Read","Edit","Bash"], model: "opus", effort: "high",
    status: "queued", pm: "ask" },
];

// Procedurally fill to 50 for the "50" tweak setting
const FILLER_NAMES = ["Pico","Nimbus","Briar","Onyx","Sable","Tessera","Quill","Drift","Solstice","Beacon","Cinder","Clay","Marrow","Rune","Foxglove","Tide","Cobalt","Ember","Halite","Vespera","Wren","Lichen","Saga","Mosaic","Halo","Kestrel","Mira","Sloan","Tundra","Verse","Wyrd","Yarrow","Zephyr"];

function buildFleet(count) {
  if (count <= HAND_AGENTS.length) return HAND_AGENTS.slice(0, count);
  const out = [...HAND_AGENTS];
  let i = 0;
  while (out.length < count) {
    const nm = FILLER_NAMES[i % FILLER_NAMES.length];
    const sk = [SKILLS[(i*3) % SKILLS.length], SKILLS[(i*5+2) % SKILLS.length]];
    const tools = [TOOLS[i%TOOLS.length], TOOLS[(i+3)%TOOLS.length], "Read"];
    const model = ["haiku","sonnet","opus"][i%3];
    const status = ["idle","idle","idle","working","done","queued","idle"][i%7];
    out.push({
      id: nm.toLowerCase()+"-"+i,
      name: nm,
      glyph: ["◯","◇","◈","◉","◍","◐","◑","✦","✶","✷","◆","✺"][i%12],
      desc: `Specialized agent for ${sk[0]} and ${sk[1]} workflows. ${["Streams structured outputs.","Designed for long-running batch jobs.","Optimized for low-latency synchronous use.","Best paired with Atlas for planning."][i%4]}`,
      skills: sk,
      tools,
      model,
      effort: ["low","medium","high"][i%3],
      status,
      pm: i%2 ? "ask" : "auto",
    });
    i++;
  }
  return out;
}

// Per-agent run history (synthetic)
function buildHistory(agents) {
  const now = Date.now();
  const out = {};
  agents.forEach((a, idx) => {
    const n = (idx * 7) % 11 + 2;
    const list = [];
    for (let k = 0; k < n; k++) {
      const ago = (k+1) * (1000*60* (5 + (k*idx)%180));
      const status = k === 0 && a.status === "working" ? "running"
        : ((idx + k) % 11 === 0 ? "error" : "done");
      list.push({
        id: a.id + "-" + k,
        agentId: a.id,
        agentName: a.name,
        ts: now - ago,
        prompt: SAMPLE_PROMPTS[(idx + k) % SAMPLE_PROMPTS.length],
        durMs: 1000 * (8 + (k*13 + idx*7)%280),
        cost: ((idx + k*3) % 47) / 20 + 0.04,
        tokensIn: 800 + (idx*111 + k*73)%9200,
        tokensOut: 200 + (idx*53 + k*31)%4200,
        status,
        model: a.model,
        effort: a.effort,
      });
    }
    out[a.id] = list;
  });
  return out;
}

const SAMPLE_PROMPTS = [
  "Compare Polars vs DuckDB for sub-second analytical queries on 5GB parquet; benchmark on the box.",
  "Audit the auth flow for CSRF and open-redirect risk; list fixes ordered by blast radius.",
  "Refactor src/billing/* — split out invoice rendering from price calc; keep tests green.",
  "QA the new onboarding on a fresh signup; file a repro for any blocking bug with screenshots.",
  "Survey papers on KV-cache compression for LLM serving since Jan 2025; group by approach.",
  "Find every TODO older than 90 days in /server and propose what to do with each.",
  "Generate vitest specs for orderbook.ts; cover ladder, partial fills, IOC, FOK, GFD.",
  "Localize the settings page into es-MX and ja-JP; flag idioms needing review.",
  "Visualize the last 30 days of latency by route; annotate the deploy windows.",
  "Migrate the React Router setup from v6 to v7 incrementally; one route group per PR.",
  "Triage the 12 open issues tagged 'mobile' — reproduce or close as won't-fix.",
  "Profile the editor's keystroke path; find any wins ≥5ms p95.",
  "Scrape the docs site for every public API and emit a typed client.",
];

const PROMPT_TEMPLATES = [
  { name: "Investigate",       body: "Investigate the following, end-to-end, and produce a brief with citations:\n\n" },
  { name: "Quick triage",      body: "Reproduce, isolate, and write a minimal repro for:\n\n" },
  { name: "Generate tests",    body: "Generate tests for the following file. Cover edge cases. Use the project's existing patterns.\n\nFile:\n" },
  { name: "Refactor plan",     body: "Propose a refactor plan for the area below. List PR-sized steps with risk per step.\n\nArea:\n" },
  { name: "Doc this",          body: "Write user-facing docs for the following. Audience: experienced devs, no jargon.\n\nSubject:\n" },
];

const STREAM_LINES = [
  { who: "agent", text: "Reading the area you mentioned." },
  { tool: "Read", arg: "src/billing/invoice.ts", note: "847 lines" },
  { tool: "Read", arg: "src/billing/price.ts",   note: "412 lines" },
  { who: "agent", text: "Both modules import from a shared `Money` type with two implementations. Splitting rendering out is safe; price calc is internally referentially-transparent." },
  { who: "agent", text: "Plan:\n  1. extract InvoiceRenderer to src/billing/render/\n  2. inline tiny helpers in price.ts that only have one caller\n  3. move totals math into PriceCalc.totals()\n  4. update 6 call sites — none cross package boundary\n" },
  { tool: "Bash", arg: "rg -n 'import.*invoice'", note: "12 matches" },
  { who: "agent", text: "Touching 12 files across `web` and `worker`. Proceeding with step 1." },
  { tool: "Edit", arg: "src/billing/render/InvoiceRenderer.tsx", note: "+184 −0" },
  { tool: "Edit", arg: "src/billing/invoice.ts", note: "+0 −172" },
  { who: "agent", text: "Step 1 done. Tests still green locally. Continuing to step 2." },
  { tool: "Bash", arg: "pnpm test billing -- --run", note: "61 passed" },
  { who: "agent", text: "" }, // streaming cursor
];

// Activity feed = flatten of running + most recent runs across all agents
function buildActivity(agents, history) {
  const out = [];
  agents.forEach(a => {
    const runs = history[a.id] || [];
    const latest = runs[0];
    if (a.status === "working" && latest) {
      out.push({ ...latest, status: "running", agentId: a.id, agentName: a.name, glyph: a.glyph });
    } else if (latest) {
      out.push({ ...latest, agentId: a.id, agentName: a.name, glyph: a.glyph });
    }
  });
  out.sort((a,b) => (b.status === "running" ? 1 : 0) - (a.status === "running" ? 1 : 0) || b.ts - a.ts);
  return out;
}

// Sparkline data per agent (recent activity intensity)
function sparkFor(agentId, len = 12) {
  const out = [];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h*31 + agentId.charCodeAt(i)) >>> 0;
  for (let i = 0; i < len; i++) {
    h = (h*1664525 + 1013904223) >>> 0;
    out.push((h & 0xff) / 255);
  }
  return out;
}

// Helpful relative formatter
function relTime(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s/60) + "m ago";
  if (s < 86400) return Math.floor(s/3600) + "h ago";
  return Math.floor(s/86400) + "d ago";
}

function fmtDur(ms) {
  if (ms < 1000) return ms + "ms";
  if (ms < 60_000) return (ms/1000).toFixed(1) + "s";
  return Math.floor(ms/60_000) + "m " + Math.floor((ms%60_000)/1000) + "s";
}

const SAMPLE_PROMPT_BODY = `Refactor src/billing/* — split out invoice rendering from price calc; keep tests green.

Notes:
 - tests at __tests__/billing/* must keep passing
 - watch out for the legacy InvoicePrinter glue at the worker boundary
 - prefer pure functions for the price calc surface
`;

// Sample system prompt body (markdown-ish)
const SAMPLE_SYS_PROMPT = `# Ren — Refactor Specialist

You are **Ren**, a focused refactoring agent. You make codebases smaller and clearer, one named area at a time.

## Operating principles
1. **Behavior preservation is non-negotiable.** Never change observable behavior unless the user asks for it explicitly.
2. **Smaller PRs always.** If a refactor is bigger than 400 lines of diff, split it.
3. **Names matter.** Pick names that describe role, not implementation.
4. **No drive-by changes.** If you spot something out of scope, file a TODO and move on.

## Workflow
- Read the target area in full before proposing changes
- Run the tests once *before* touching anything; record baseline
- Propose the plan as a numbered list with one-line rationale per step
- Execute one step, run tests, then continue. If tests fail, stop and ask.

## Tools
- \`Read\`, \`Edit\` — primary
- \`Bash\` — for tests, git, simple greps. Never for installs.

## Skills
\`refactor\` \`code-review\`
`;

Object.assign(window, {
  SKILLS, TOOLS, HAND_AGENTS,
  buildFleet, buildHistory, buildActivity,
  sparkFor, relTime, fmtDur,
  SAMPLE_PROMPTS, PROMPT_TEMPLATES, STREAM_LINES,
  SAMPLE_PROMPT_BODY, SAMPLE_SYS_PROMPT,
});
