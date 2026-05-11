// Live runs: manages active claude -p subprocs and broadcasts events to subscribed WSs.
// Lets a client reconnect to an in-flight run via /api/summon WS with {type:"attach", runId}.

import { spawn } from "bun";
import type { Subprocess } from "bun";
import type { ServerWebSocket } from "bun";
import type { WSServerMessage, PersistedRun } from "../shared/types";
import { log } from "./log";
import { pushRun } from "./store";

interface LiveRun {
  id: string;
  agentId: string;
  agentName: string;
  startTs: number;
  prompt: string;
  model: string;
  effort: string;
  cwd?: string;
  projectId?: string;
  instanceId?: string;
  instanceLabel?: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  status: "running" | "done" | "error";
  exitCode?: number;
  proc: Subprocess;
  subscribers: Set<ServerWebSocket<any>>;
  events: WSServerMessage[];
  finishedAt?: number;
  parseFailures: number;
  sawStreamDelta: boolean; // when true, suppress text from `assistant` events to avoid duplicates
}

const liveRuns = new Map<string, LiveRun>();
const RUN_RETENTION_MS = 5 * 60_000; // keep finished runs around 5 minutes for late attachers

function gc() {
  const cutoff = Date.now() - RUN_RETENTION_MS;
  for (const [id, run] of liveRuns) {
    if (run.status !== "running" && (run.finishedAt ?? 0) < cutoff) {
      liveRuns.delete(id);
    }
  }
}
setInterval(gc, 60_000);

export function getLiveRun(runId: string): LiveRun | undefined {
  return liveRuns.get(runId);
}

export function startRun(opts: {
  runId: string;
  agentId: string;
  agentName: string;
  prompt: string;
  model: string;
  effort: string;
  cwd?: string;
  projectId?: string;
  instanceId?: string;
  instanceLabel?: string;
  args: string[];
}): LiveRun {
  const proc = spawn(opts.args, { stdout: "pipe", stderr: "pipe", cwd: opts.cwd });
  const run: LiveRun = {
    id: opts.runId,
    agentId: opts.agentId,
    agentName: opts.agentName,
    startTs: Date.now(),
    prompt: opts.prompt,
    model: opts.model,
    effort: opts.effort,
    cwd: opts.cwd,
    projectId: opts.projectId,
    instanceId: opts.instanceId,
    instanceLabel: opts.instanceLabel,
    output: "",
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    status: "running",
    proc,
    subscribers: new Set(),
    events: [],
    parseFailures: 0,
    sawStreamDelta: false,
  };
  liveRuns.set(opts.runId, run);

  log.info("run.start", { runId: opts.runId, agent: opts.agentId, cwd: opts.cwd });

  pumpStdout(run);
  pumpStderr(run);
  proc.exited.then((exitCode) => finalizeRun(run, exitCode));

  return run;
}

export function attachWS(runId: string, ws: ServerWebSocket<any>): boolean {
  const run = liveRuns.get(runId);
  if (!run) return false;
  run.subscribers.add(ws);
  send(ws, {
    type: "attached",
    runId,
    output: run.output,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
    cost: run.cost,
    status: run.status,
    startTs: run.startTs,
  });
  // Replay any events that came after the most recent state already sent? We've sent the
  // current snapshot, so no replay needed — future events will come via broadcast.
  if (run.status !== "running") {
    send(ws, { type: "done", exitCode: run.exitCode ?? 0 });
  }
  return true;
}

export function detachWS(ws: ServerWebSocket<any>) {
  for (const run of liveRuns.values()) run.subscribers.delete(ws);
}

export function abortRun(runId: string): boolean {
  const run = liveRuns.get(runId);
  if (!run) return false;
  try { run.proc.kill(); } catch {}
  return true;
}

function send(ws: ServerWebSocket<any>, msg: WSServerMessage) {
  try { ws.send(JSON.stringify(msg)); } catch {}
}

function broadcast(run: LiveRun, msg: WSServerMessage) {
  run.events.push(msg);
  for (const ws of run.subscribers) send(ws, msg);
}

async function pumpStdout(run: LiveRun) {
  const stdout = run.proc.stdout as ReadableStream<Uint8Array>;
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let lastChunkAt = Date.now();

  // Watchdog: if no chunks for 15s while running, log a warning
  const watchdog = setInterval(() => {
    if (run.status !== "running") return;
    if (Date.now() - lastChunkAt > 15_000) {
      log.warn("run.silent", { runId: run.id, parseFailures: run.parseFailures });
    }
  }, 5_000);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) {
          const handled = handleStreamLine(run, line);
          if (handled) lastChunkAt = Date.now();
        }
      }
    }
    if (buf.trim()) handleStreamLine(run, buf.trim());
  } catch (e) {
    broadcast(run, { type: "error", message: String(e) });
  } finally {
    clearInterval(watchdog);
  }
}

async function pumpStderr(run: LiveRun) {
  const stderr = run.proc.stderr as ReadableStream<Uint8Array>;
  const reader = stderr.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      log.debug("run.stderr", { runId: run.id, text: text.slice(0, 200) });
    }
  } catch {}
}

function handleStreamLine(run: LiveRun, line: string): boolean {
  let evt: any;
  try { evt = JSON.parse(line); } catch {
    run.parseFailures++;
    if (run.parseFailures <= 3) {
      log.warn("run.unparseable_line", { runId: run.id, line: line.slice(0, 200) });
    }
    return false;
  }

  // Streamed text deltas (--include-partial-messages)
  if (evt.type === "stream_event" && evt.event) {
    const ev = evt.event;
    if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && typeof ev.delta.text === "string") {
      run.sawStreamDelta = true;
      run.output += ev.delta.text;
      broadcast(run, { type: "chunk", text: ev.delta.text });
      return true;
    }
    if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use") {
      broadcast(run, { type: "tool", name: ev.content_block.name, input: ev.content_block.input });
      return true;
    }
    return true; // recognized event, just no payload to forward
  }

  // Full assistant message — when partial deltas have already streamed, the text in
  // this event is a duplicate; only mine it for tool_use blocks and usage.
  if (evt.type === "assistant" && evt.message?.content) {
    for (const block of evt.message.content) {
      if (block.type === "text" && typeof block.text === "string" && !run.sawStreamDelta) {
        run.output += block.text;
        broadcast(run, { type: "chunk", text: block.text });
      } else if (block.type === "tool_use") {
        broadcast(run, { type: "tool", name: block.name, input: block.input });
      }
    }
    // Live usage update (cost is filled in from result event at end of run).
    if (evt.message.usage) {
      const ti = evt.message.usage.input_tokens;
      const to = evt.message.usage.output_tokens;
      if (typeof ti === "number") run.tokensIn = ti;
      if (typeof to === "number") run.tokensOut = to;
      broadcast(run, { type: "usage", tokensIn: run.tokensIn, tokensOut: run.tokensOut, cost: run.cost });
    }
    return true;
  }

  // Final result (authoritative usage + cost)
  if (evt.type === "result") {
    if (evt.usage) {
      run.tokensIn = evt.usage.input_tokens ?? run.tokensIn;
      run.tokensOut = evt.usage.output_tokens ?? run.tokensOut;
    }
    if (typeof evt.total_cost_usd === "number") run.cost = evt.total_cost_usd;
    broadcast(run, { type: "usage", tokensIn: run.tokensIn, tokensOut: run.tokensOut, cost: run.cost });
    return true;
  }

  return true;
}

function finalizeRun(run: LiveRun, exitCode: number) {
  run.status = exitCode === 0 ? "done" : "error";
  run.exitCode = exitCode;
  run.finishedAt = Date.now();

  log.info("run.end", { runId: run.id, exitCode, durMs: run.finishedAt - run.startTs, cost: run.cost });

  const persisted: PersistedRun = {
    id: run.id,
    agentId: run.agentId,
    agentName: run.agentName,
    ts: run.startTs,
    prompt: run.prompt,
    status: run.status,
    output: run.output,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
    cost: run.cost,
    durMs: run.finishedAt - run.startTs,
    model: run.model,
    effort: run.effort,
    cwd: run.cwd,
    projectId: run.projectId,
    instanceId: run.instanceId,
    instanceLabel: run.instanceLabel,
  };
  pushRun(persisted);

  broadcast(run, { type: "done", exitCode });
}

export function killAllRuns() {
  for (const run of liveRuns.values()) {
    try { run.proc.kill(); } catch {}
  }
}
