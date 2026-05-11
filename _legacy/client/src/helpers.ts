// Display helpers + small client-side state.

export const TOOLS = [
  "Read", "Write", "Edit", "Bash", "WebFetch", "WebSearch",
  "Computer", "MCP:postgres", "MCP:github", "MCP:linear",
];

export const ROOMS = ["Research", "Build", "QA", "Ops"] as const;
export type Room = typeof ROOMS[number];

export const PROMPT_TEMPLATES = [
  { name: "Investigate",   body: "Investigate the following, end-to-end, and produce a brief with citations:\n\n" },
  { name: "Quick triage",  body: "Reproduce, isolate, and write a minimal repro for:\n\n" },
  { name: "Generate tests", body: "Generate tests for the following file. Cover edge cases. Use the project's existing patterns.\n\nFile:\n" },
  { name: "Refactor plan", body: "Propose a refactor plan for the area below. List PR-sized steps with risk per step.\n\nArea:\n" },
  { name: "Doc this",      body: "Write user-facing docs for the following. Audience: experienced devs, no jargon.\n\nSubject:\n" },
];

// Decorative sparkline data — deterministic per agent id, not real activity
export function sparkFor(id: string, len = 12): number[] {
  const out: number[] = [];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  for (let i = 0; i < len; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out.push((h & 0xff) / 255);
  }
  return out;
}

export function relTime(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export function fmtDur(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return ms + "ms";
  if (ms < 60_000) return (ms / 1000).toFixed(1) + "s";
  return Math.floor(ms / 60_000) + "m " + Math.floor((ms % 60_000) / 1000) + "s";
}

const FILLER_GLYPHS = ["◯", "◇", "◈", "◉", "◍", "◐", "◑", "✦", "✶", "✷", "◆", "✺"];
export function glyphFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FILLER_GLYPHS[h % FILLER_GLYPHS.length];
}
