// End-to-end smoke test. Connects via WS, runs a tiny prompt against researcher,
// asserts: text streams, usage/cost arrives, run persists to _runs.log, attach works.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RUN_ID = "smoke-" + Date.now();
const PROMPT = "Reply with only the single word READY and nothing else. Do not call any tools.";
const LOG_PATH = join(homedir(), ".claude", "agents", "_runs.log");

interface Event { type: string; [k: string]: unknown; }

function summon(): Promise<{ events: Event[]; runId: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://127.0.0.1:3001/api/summon");
    const events: Event[] = [];

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("summon timeout (90s)"));
    }, 90_000);

    ws.addEventListener("open", () => {
      console.log("[summon] open");
      ws.send(JSON.stringify({
        type: "summon",
        runId: RUN_ID,
        agent: "researcher",
        prompt: PROMPT,
        model: "haiku",
        effort: "low",
      }));
    });
    ws.addEventListener("message", (e) => {
      const data = JSON.parse(String(e.data)) as Event;
      events.push(data);
      const summary = data.type === "chunk"
        ? JSON.stringify(String(data.text).slice(0, 60))
        : data.type === "tool"  ? `name=${data.name}`
        : data.type === "usage" ? `in=${data.tokensIn} out=${data.tokensOut} cost=$${data.cost}`
        : data.type === "done"  ? `exit=${data.exitCode}`
        : data.type === "error" ? `msg=${data.message}`
        : "";
      console.log(`[summon] ${data.type} ${summary}`);
      if (data.type === "done") {
        clearTimeout(timeout);
        ws.close();
        resolve({ events, runId: RUN_ID });
      }
    });
    ws.addEventListener("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

function attach(runId: string): Promise<Event[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://127.0.0.1:3001/api/summon");
    const events: Event[] = [];
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("attach timeout (10s)"));
    }, 10_000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "attach", runId }));
    });
    ws.addEventListener("message", (e) => {
      const data = JSON.parse(String(e.data)) as Event;
      events.push(data);
      console.log(`[attach] ${data.type}`);
      if (data.type === "done" || data.type === "error") {
        clearTimeout(timeout);
        ws.close();
        resolve(events);
      }
    });
    ws.addEventListener("error", (e) => { clearTimeout(timeout); reject(e); });
  });
}

function pass(label: string) { console.log(`  ✓ ${label}`); }
function fail(label: string, detail?: string): never {
  console.error(`  ✗ ${label}${detail ? "\n    " + detail : ""}`);
  process.exit(1);
}

async function main() {
  console.log("\n=== Phase 1: Health check ===");
  const health = await fetch("http://127.0.0.1:3001/api/health").then(r => r.json()) as any;
  if (!health.available) fail("claude CLI available", JSON.stringify(health));
  pass(`claude CLI: ${health.version}`);

  console.log("\n=== Phase 2: Agents listing ===");
  const agents = await fetch("http://127.0.0.1:3001/api/agents").then(r => r.json()) as any[];
  const researcher = agents.find(a => a.name === "researcher");
  if (!researcher) fail("researcher agent found");
  pass(`agents: ${agents.map(a => a.name).join(", ")}`);

  console.log("\n=== Phase 3: Summon ===");
  console.log(`  prompt: ${PROMPT}`);
  console.log(`  runId: ${RUN_ID}`);
  const t0 = Date.now();
  const { events } = await summon();
  const elapsed = Date.now() - t0;
  console.log(`  total time: ${elapsed}ms`);

  console.log("\n=== Phase 4: Verify event stream ===");
  const chunks = events.filter(e => e.type === "chunk");
  const tools = events.filter(e => e.type === "tool");
  const usages = events.filter(e => e.type === "usage");
  const dones = events.filter(e => e.type === "done");
  const errors = events.filter(e => e.type === "error");

  console.log(`  chunks: ${chunks.length}`);
  console.log(`  tools:  ${tools.length}`);
  console.log(`  usages: ${usages.length}`);
  console.log(`  dones:  ${dones.length}`);
  console.log(`  errors: ${errors.length}`);

  const text = chunks.map(c => String(c.text)).join("");
  console.log(`  full text: ${JSON.stringify(text.slice(0, 200))}`);

  if (chunks.length === 0) fail("at least one text chunk", "no chunk events received — stream-json parsing likely broken");
  pass(`got ${chunks.length} text chunks`);

  if (text.trim().length === 0) fail("text content non-empty");
  pass("text content non-empty");

  if (usages.length === 0) fail("usage event", "no usage event received — cost tracking broken");
  pass(`got ${usages.length} usage events`);

  const finalUsage = usages[usages.length - 1] as any;
  if (typeof finalUsage.tokensIn !== "number" || finalUsage.tokensIn <= 0) {
    fail("tokensIn > 0", `tokensIn = ${finalUsage.tokensIn}`);
  }
  pass(`final tokensIn = ${finalUsage.tokensIn}`);

  if (typeof finalUsage.tokensOut !== "number" || finalUsage.tokensOut <= 0) {
    fail("tokensOut > 0", `tokensOut = ${finalUsage.tokensOut}`);
  }
  pass(`final tokensOut = ${finalUsage.tokensOut}`);

  if (typeof finalUsage.cost !== "number" || finalUsage.cost <= 0) {
    fail("cost > 0", `cost = ${finalUsage.cost} — total_cost_usd not arriving from result event`);
  }
  pass(`final cost = $${finalUsage.cost.toFixed(6)}`);

  if (dones.length !== 1) fail("exactly one done event", `got ${dones.length}`);
  if ((dones[0] as any).exitCode !== 0) fail("clean exit", `exitCode = ${(dones[0] as any).exitCode}`);
  pass("clean exit (code 0)");

  if (errors.length > 0) fail("no error events", JSON.stringify(errors));

  console.log("\n=== Phase 5: Verify persistence ===");
  if (!existsSync(LOG_PATH)) fail("_runs.log exists");
  pass(`log exists: ${LOG_PATH}`);

  const lines = readFileSync(LOG_PATH, "utf8").trim().split("\n").filter(Boolean);
  const ours = lines.map(l => JSON.parse(l)).find(r => r.id === RUN_ID);
  if (!ours) fail("our run in _runs.log");
  pass("run persisted");
  console.log(`    id:       ${ours.id}`);
  console.log(`    status:   ${ours.status}`);
  console.log(`    output:   ${JSON.stringify(ours.output.slice(0, 80))}`);
  console.log(`    tokensIn: ${ours.tokensIn}`);
  console.log(`    tokensOut:${ours.tokensOut}`);
  console.log(`    cost:     $${ours.cost.toFixed(6)}`);
  console.log(`    durMs:    ${ours.durMs}`);

  if (ours.output.length === 0) fail("persisted output non-empty");
  pass("persisted output non-empty");

  if (ours.tokensIn <= 0 || ours.tokensOut <= 0) fail("persisted token counts > 0");
  pass("persisted token counts > 0");

  if (ours.cost <= 0) fail("persisted cost > 0");
  pass("persisted cost > 0");

  console.log("\n=== Phase 6: Verify reattach to completed run ===");
  const attachEvents = await attach(RUN_ID);
  const attached = attachEvents.find(e => e.type === "attached");
  if (!attached) fail("attached event received", JSON.stringify(attachEvents));
  pass(`attached event with output (${(attached as any).output.length} chars), status=${(attached as any).status}`);

  console.log("\n=== Phase 7: Verify recent-prompts captured ===");
  const recents = await fetch("http://127.0.0.1:3001/api/agents/researcher/prompts").then(r => r.json()) as string[];
  if (!recents.includes(PROMPT)) fail("prompt saved to recent-prompts", `recents=${JSON.stringify(recents.slice(0, 3))}`);
  pass(`prompt is in recent-prompts (${recents.length} total)`);

  console.log("\n✓ ALL CHECKS PASSED\n");
  process.exit(0);
}

main().catch(e => {
  console.error("\n✗ FAILED:", e);
  process.exit(1);
});
