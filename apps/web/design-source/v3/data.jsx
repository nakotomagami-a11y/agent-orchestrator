// v3/data.jsx — expanded fleet (16) with roles + moods + desk states

const V3_SKILLS = [
  "frontend","backend","qa","docs","research","refactor",
  "security","data","ml","devops","design","i18n",
];

const V3_TOOLS = ["Read","Write","Edit","Bash","Grep","WebSearch","WebFetch","MCP:github","Computer"];

const V3_AGENTS = [
  { id: "frontend-architect", name: "Frontend Architect", short: "Arc", role: "architect",
    desc: "Designs UI/UX flows, component models, state shapes. Plan-mode only, never implements.",
    skills: ["frontend","design"], tools: ["Read","Grep","Bash"],
    model: "opus", effort: "high",
    sprite: { skin: "#F5C68C", hair: "#3B2F2A", shirt: "#77216F", accessory: "headphones" },
    desk: { tier: 0, slot: 0, plant: true, monitor: 2 },
    status: "working", task: "Reviewing component hierarchy", taskKind: "Reading",
  },
  { id: "frontend-craftsman", name: "Frontend Craftsman", short: "Crafts", role: "implementer",
    desc: "Implements high-fidelity UI to spec. Pixel-aware, a11y-aware, mirrors existing patterns.",
    skills: ["frontend","design"], tools: ["Read","Write","Edit","Bash"],
    model: "sonnet", effort: "high",
    sprite: { skin: "#E3A684", hair: "#48342A", shirt: "#0E8420", accessory: "glasses" },
    desk: { tier: 0, slot: 1, plant: false, monitor: 1 },
    status: "idle",
  },
  { id: "frontend-a11y", name: "Frontend A11y", short: "A11y", role: "reviewer",
    desc: "Accessibility-first reviewer + fixer. WCAG 2.2 AA enforced. Keyboard, screen-reader, contrast.",
    skills: ["frontend","qa"], tools: ["Read","Edit","Bash"],
    model: "sonnet", effort: "high",
    sprite: { skin: "#C98C63", hair: "#C28A00", shirt: "#1E66BE", accessory: "earbuds" },
    desk: { tier: 0, slot: 2, plant: false, monitor: 1 },
    status: "thinking", task: "Auditing focus order on /checkout", taskKind: "Thinking",
  },
  { id: "frontend-pragmatist", name: "Frontend Pragmatist", short: "Prag", role: "implementer",
    desc: "Ships features fast, mirrors existing conventions, minimal doctrine.",
    skills: ["frontend"], tools: ["Read","Write","Edit","Bash"],
    model: "sonnet", effort: "medium",
    sprite: { skin: "#F6C8A3", hair: "#7E3F2E", shirt: "#E95420", accessory: null },
    desk: { tier: 0, slot: 3, plant: true, monitor: 1 },
    status: "idle",
  },
  { id: "backend-builder", name: "Backend Builder", short: "Build", role: "implementer",
    desc: "Implements features, validates at boundaries, idempotent endpoints, migration safety.",
    skills: ["backend"], tools: ["Read","Write","Edit","Bash","Grep"],
    model: "sonnet", effort: "high",
    sprite: { skin: "#7E5238", hair: "#2B2330", shirt: "#2C001E", accessory: "cap" },
    desk: { tier: 1, slot: 0, plant: false, monitor: 2 },
    status: "working", task: "Adding rate limit to /v2/orders", taskKind: "Editing",
  },
  { id: "backend-reviewer", name: "Backend Reviewer", short: "Rev", role: "reviewer",
    desc: "Read-only backend reviewer — flags correctness, security (OWASP), perf, API contract risks. Doesn't edit.",
    skills: ["backend","security"], tools: ["Read","Grep","Bash"],
    model: "sonnet", effort: "high",
    sprite: { skin: "#E3A684", hair: "#A3A8B8", shirt: "#5E5C64", accessory: "glasses" },
    desk: { tier: 1, slot: 1, plant: true, monitor: 1 },
    status: "idle",
  },
  { id: "qa-codebase", name: "QA Codebase", short: "QA-cb", role: "qa",
    desc: "Reads source code, identifies test gaps, writes tests filling them in the project's style.",
    skills: ["qa","backend"], tools: ["Read","Write","Edit","Bash"],
    model: "sonnet", effort: "medium",
    sprite: { skin: "#F5C68C", hair: "#C98A3E", shirt: "#0E8420", accessory: null },
    desk: { tier: 1, slot: 2, plant: false, monitor: 1 },
    status: "done", task: "Wrote 12 tests for orderbook.ts", taskKind: "Done",
  },
  { id: "qa-explorer", name: "QA Explorer", short: "QA-x", role: "qa",
    desc: "Drives a real browser to QA flows. Files repros with screenshots.",
    skills: ["qa"], tools: ["Read","Computer","WebFetch"],
    model: "sonnet", effort: "medium",
    sprite: { skin: "#C98C63", hair: "#3B2F2A", shirt: "#77216F", accessory: "headphones" },
    desk: { tier: 1, slot: 3, plant: false, monitor: 1 },
    status: "working", task: "Repro for issue #4421 (Safari)", taskKind: "Running",
  },
  { id: "researcher-deep", name: "Deep Researcher", short: "Res", role: "research",
    desc: "Plans multi-step research across the open web; produces structured briefs with citations.",
    skills: ["research","docs"], tools: ["WebSearch","WebFetch","Read","Write"],
    model: "opus", effort: "high",
    sprite: { skin: "#F6C8A3", hair: "#2B2330", shirt: "#1E66BE", accessory: "glasses" },
    desk: { tier: 2, slot: 0, plant: true, monitor: 1 },
    status: "idle",
  },
  { id: "scribe", name: "Scribe", short: "Scribe", role: "docs",
    desc: "Writes and updates docs from source — README, API refs, ADRs, migration notes.",
    skills: ["docs"], tools: ["Read","Write","Edit"],
    model: "haiku", effort: "low",
    sprite: { skin: "#E3A684", hair: "#7E3F2E", shirt: "#C28A00", accessory: null },
    desk: { tier: 2, slot: 1, plant: false, monitor: 1 },
    status: "idle",
  },
  { id: "refactor-ren", name: "Ren", short: "Ren", role: "refactor",
    desc: "Refactors a focused area into smaller, named units. Preserves behavior; updates callers.",
    skills: ["refactor"], tools: ["Read","Edit","Bash"],
    model: "sonnet", effort: "medium",
    sprite: { skin: "#7E5238", hair: "#48342A", shirt: "#0E8420", accessory: "earbuds" },
    desk: { tier: 2, slot: 2, plant: false, monitor: 2 },
    status: "queued", task: "Queue: split billing/render", taskKind: "Queued",
  },
  { id: "sentry", name: "Sentry", short: "Sentry", role: "security",
    desc: "Audits dependencies, secrets, IAM for known risks. Outputs prioritized fix list with diffs.",
    skills: ["security","devops"], tools: ["Read","Bash","WebFetch","Grep"],
    model: "opus", effort: "high",
    sprite: { skin: "#C98C63", hair: "#A3A8B8", shirt: "#2C001E", accessory: "cap" },
    desk: { tier: 2, slot: 3, plant: false, monitor: 2 },
    status: "error", task: "MCP:github auth expired", taskKind: "Blocked",
  },
  { id: "data-lumen", name: "Lumen", short: "Lumen", role: "data",
    desc: "Visualizes datasets — picks chart types, generates interactive HTML with caveats.",
    skills: ["data","design"], tools: ["Read","Write","Bash"],
    model: "sonnet", effort: "medium",
    sprite: { skin: "#F5C68C", hair: "#C98A3E", shirt: "#E95420", accessory: "headphones" },
    desk: { tier: 3, slot: 0, plant: true, monitor: 2 },
    status: "idle",
  },
  { id: "ml-auger", name: "Auger", short: "Auger", role: "ml",
    desc: "Runs targeted ML experiments end-to-end: dataset → train → eval → report.",
    skills: ["ml","data"], tools: ["Read","Write","Bash"],
    model: "opus", effort: "high",
    sprite: { skin: "#7E5238", hair: "#2B2330", shirt: "#77216F", accessory: "glasses" },
    desk: { tier: 3, slot: 1, plant: false, monitor: 2 },
    status: "thinking", task: "Considering 3 eval splits", taskKind: "Thinking",
  },
  { id: "devops-boreal", name: "Boreal", short: "Boreal", role: "devops",
    desc: "Cold-starts new repos with conventional layouts, CI, lint, prettier, vitest.",
    skills: ["devops","docs"], tools: ["Read","Write","Bash"],
    model: "haiku", effort: "low",
    sprite: { skin: "#E3A684", hair: "#7E3F2E", shirt: "#1E66BE", accessory: null },
    desk: { tier: 3, slot: 2, plant: false, monitor: 1 },
    status: "idle",
  },
  { id: "i18n-poly", name: "Polyglot", short: "Poly", role: "i18n",
    desc: "Adds locales to UI strings, audits hardcoded copy, writes ICU-formatted message catalogs.",
    skills: ["i18n","docs"], tools: ["Read","Edit","Write"],
    model: "haiku", effort: "low",
    sprite: { skin: "#F6C8A3", hair: "#C98A3E", shirt: "#0E8420", accessory: "earbuds" },
    desk: { tier: 3, slot: 3, plant: true, monitor: 1 },
    status: "done", task: "Localized /settings to es-MX, ja-JP", taskKind: "Done",
  },
];

// Chat seed conversations per agent (Claude/ChatGPT-style)
const V3_CONVOS = {
  "frontend-architect": [
    { role: "you", text: "We need to completely overhaul the checkout flow — it's 4 screens, fields scatter across them, conversion is dropping. What do you suggest?", t: -2200 },
    { role: "agent", t: -2100, parts: [
      { type: "thinking", text: "Reading the existing flow + the analytics doc you linked." },
      { type: "tool", name: "Read", arg: "src/checkout/*.tsx", note: "8 files · 1,842 lines",
        body: "checkout/\n  ShippingScreen.tsx   412 lines\n  PaymentScreen.tsx    387 lines\n  ReviewScreen.tsx     245 lines\n  ConfirmScreen.tsx    198 lines\n  ...",
      },
      { type: "tool", name: "WebFetch", arg: "analytics/checkout-funnel-q1.pdf", note: "12.4 KB",
        body: "Drop-off: 38% Shipping → Payment\n             24% Payment → Review\n             8%  Review → Confirm\nMost-skipped field: company name (87% blank)",
      },
      { type: "text", text: "Three takes — I'd recommend Option B.\n\n**Option A — Single page, accordion sections.** Familiar, keeps the 4-step mental model but removes route switches. Low risk, mid reward (~10% lift expected).\n\n**Option B — Two-screen, smart defaults.** Merge Shipping + Payment with autofill from saved cards; ditch Company unless cart contains a B2B SKU. One Review step. Predicted ~22% lift on the Shipping→Payment drop.\n\n**Option C — Inline drawer over cart.** Most ambitious. Cart stays visible the entire time. Drawer slides up with progressive fields. High reward, high risk on mobile — requires a fresh form-state model.\n\nWant me to draft a state-shape + component tree for one of these?" },
    ]},
    { role: "you", text: "Let's go with B. Draft the state shape.", t: -200 },
    { role: "agent", t: -100, streaming: true, parts: [
      { type: "thinking", text: "Designing a flat state — three sections, derived eligibility flags, single source of truth for validation." },
      { type: "code", lang: "ts", title: "checkout/state.ts",
        body:
`type CheckoutState = {
  // Shared address (shipping = billing unless flagged)
  contact:  { email: string; phone?: string };
  ship:     { line1: string; line2?: string; city: string; postal: string; country: ISO2 };
  billing:  { sameAsShip: boolean; line1?: string; postal?: string; country?: ISO2 };

  payment:  { method: 'card'|'wallet'|'klarna';
              card?: { brand: CardBrand; last4: string; exp: string; cvcOk: boolean };
              wallet?: { kind: 'apple'|'google'|'paypal'; token: string } };

  meta:     { b2bMode: boolean; promoCode?: string; giftMessage?: string };
};

const eligibility = (s: CheckoutState) => ({
  canSubmit:    isAddrValid(s.ship) && isPaymentValid(s.payment),
  needsCompany: s.meta.b2bMode,
  showReview:   eligibility(s).canSubmit && !s.meta.fastTrack,
});` },
      { type: "text", text: "I left `billing.sameAsShip = true` as the default — that's the single biggest perf win on mobile (no re-render of the billing block).\n\nWant me to outline the component tree next, or hand this off to **Crafts** to start building?" },
    ]},
  ],
  // others use a small generic conversation
};

function v3MakeGenericConvo(a) {
  return [
    { role: "you", text: `Hey ${a.short}, can you take a look at this and give me your read?`, t: -700 },
    { role: "agent", t: -600, parts: [
      { type: "thinking", text: "Loading context and getting oriented." },
      { type: "tool", name: "Read", arg: "src/" + a.role + "/index.ts", note: "Read ok · 240 lines",
        body: "// glanced at the entrypoint, looks fine\n// dependencies: see package.json" },
      { type: "text", text: `Quick read on this — it's solid, just a few things I'd tighten up:\n\n1. The error path on the boundary swallows the underlying cause — propagate via cause chain.\n2. There's an unused import in line 34.\n3. The test for the empty case asserts on a stale snapshot.\n\nWant me to fix all three in one pass, or one at a time?` },
    ]},
  ];
}

// Activity items — recent runs across fleet
function v3BuildActivity(agents) {
  const out = [];
  let t = Date.now();
  const lines = [
    ["read", "src/billing/invoice.ts"],
    ["edit", "src/api/routes/orders.ts +24 -8"],
    ["bash", "pnpm test billing -- --run"],
    ["read", "docs/architecture.md"],
    ["edit", "src/checkout/state.ts +84 -0"],
    ["bash", "rg -n 'TODO\\(.*\\)' src/"],
    ["read", "package.json"],
    ["edit", "src/components/Button.tsx +12 -4"],
  ];
  agents.forEach((a, idx) => {
    for (let k = 0; k < 2; k++) {
      const [kind, what] = lines[(idx + k*3) % lines.length];
      const ago = ((idx + k) * 137 + 60) * 1000;
      out.push({ agentId: a.id, agentName: a.short, kind, what, ts: t - ago });
    }
  });
  return out.sort((a,b) => b.ts - a.ts);
}

function v3Rel(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s/60) + "m";
  return Math.floor(s/3600) + "h";
}

// Slash commands
const SLASH = [
  { cmd: "/clone",    desc: "Clone this agent and tweak in the wizard" },
  { cmd: "/edit",     desc: "Open the agent's system-prompt editor" },
  { cmd: "/budget",   desc: "Set a hard $ ceiling on this run" },
  { cmd: "/model",    desc: "Override model for this message (haiku/sonnet/opus)" },
  { cmd: "/effort",   desc: "Override effort (low/medium/high)" },
  { cmd: "/attach",   desc: "Attach a file or image" },
  { cmd: "/clear",    desc: "Clear conversation context" },
  { cmd: "/cwd",      desc: "Change working directory for this run" },
];

Object.assign(window, {
  V3_SKILLS, V3_TOOLS, V3_AGENTS, V3_CONVOS,
  v3MakeGenericConvo, v3BuildActivity, v3Rel, SLASH,
});
