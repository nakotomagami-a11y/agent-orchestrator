// Live run registry. Spawns `claude` subprocesses, parses stream-json output,
// and broadcasts events to subscribed SSE writers.
//
// Each subscriber is a callback (`SseEmit`) instead of a websocket - works with
// `apps/web/src/lib/sse.ts` writers and any other consumer.

import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { PersistedRun, SseAttachedEvent, SseChunkEvent, SseDoneEvent, SseErrorEvent, SseToolEvent, SseUsageEvent } from "../types/index";
import { log } from "./log";
import { buildAugmentedPath } from "./paths";
import { pushRun } from "./store";
import { appendRun as appendHistory } from "./history";
import * as db from "./db";

export type SseEvent =
  | { name: "attached"; data: SseAttachedEvent }
  | { name: "chunk"; data: SseChunkEvent }
  | { name: "tool"; data: SseToolEvent }
  | { name: "usage"; data: SseUsageEvent }
  | { name: "done"; data: SseDoneEvent }
  | { name: "error"; data: SseErrorEvent };

export type SseEmit = (event: SseEvent) => void | Promise<void>;

type ReplayableEvent = Extract<SseEvent, { name: "chunk" | "tool" | "usage" }>;

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
  sessionId?: string;
  proc: ChildProcessByStdio<null, Readable, Readable>;
  subscribers: Set<SseEmit>;
  finishedAt?: number;
  parseFailures: number;
  sawStreamDelta: boolean;
  rateLimitResetsAt?: number;
  args: string[];
  stderrBuf: string;
  lastActivityAt: number;
  /** Ordered log of chunk/tool/usage events for full replay to late subscribers. */
  eventLog: ReplayableEvent[];
}

const IDLE_TIMEOUT_MS = 10 * 60_000; // kill runs with no stdout for 10 min

declare global {
  // eslint-disable-next-line no-var
  var __agentOfficeLiveRuns: Map<string, LiveRun> | undefined;
  // eslint-disable-next-line no-var
  var __agentOfficeRunsInstalled: boolean | undefined;
  // Indirection so the signal handler always invokes the *current* module's
  // killAllRuns - without this, HMR replaces the function but the SIGINT
  // handler stays bound to the old one and our new finalize-on-kill logic
  // never runs until the dev server is fully restarted.
  // eslint-disable-next-line no-var
  var __agentOfficeKillAllRuns: (() => void) | undefined;
}

const liveRuns: Map<string, LiveRun> =
  globalThis.__agentOfficeLiveRuns ??
  (globalThis.__agentOfficeLiveRuns = new Map());

const RUN_RETENTION_MS = 4 * 60 * 60_000;

function gc(): void {
  const now = Date.now();
  const cutoff = now - RUN_RETENTION_MS;
  for (const [id, run] of liveRuns) {
    if (run.status !== "running" && (run.finishedAt ?? 0) < cutoff) {
      liveRuns.delete(id);
      continue;
    }
    if (run.status === "running" && now - run.lastActivityAt > IDLE_TIMEOUT_MS) {
      log.warn("run.idle_timeout", { runId: id, idleMs: now - run.lastActivityAt });
      broadcast(run, { name: "error", data: { runId: id, message: "Run timed out after 10 minutes of inactivity." } });
      try { run.proc.kill(); } catch { /* already gone */ }
    }
  }
}

// Always keep the current module's killAllRuns in the global slot. HMR
// replaces the function reference each reload; the handlers below read
// through the global so the latest version always wins.
globalThis.__agentOfficeKillAllRuns = killAllRuns;

if (!globalThis.__agentOfficeRunsInstalled) {
  setInterval(gc, 60_000).unref();
  process.on("SIGINT", () => {
    globalThis.__agentOfficeKillAllRuns?.();
  });
  process.on("SIGTERM", () => {
    globalThis.__agentOfficeKillAllRuns?.();
  });
  globalThis.__agentOfficeRunsInstalled = true;
}

export function getLiveRun(runId: string): LiveRun | undefined {
  return liveRuns.get(runId);
}

export function getLiveRunAsPersistedRun(runId: string): PersistedRun | undefined {
  const r = liveRuns.get(runId);
  if (!r) return undefined;
  return {
    id: r.id,
    agentId: r.agentId,
    agentName: r.agentName,
    ts: r.startTs,
    prompt: r.prompt,
    status: r.status,
    exitCode: r.exitCode,
    output: r.output,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    cost: r.cost,
    durMs: Date.now() - r.startTs,
    model: r.model,
    effort: r.effort,
    cwd: r.cwd,
    projectId: r.projectId,
    instanceId: r.instanceId,
    instanceLabel: r.instanceLabel,
    sessionId: r.sessionId,
  };
}

export function getRunningRuns(): PersistedRun[] {
  return Array.from(liveRuns.values())
    .filter((r) => r.status === "running")
    .map((r): PersistedRun => ({
      id: r.id,
      agentId: r.agentId,
      agentName: r.agentName,
      ts: r.startTs,
      prompt: r.prompt,
      status: "running",
      output: r.output,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      cost: r.cost,
      durMs: Date.now() - r.startTs,
      model: r.model,
      effort: r.effort,
      cwd: r.cwd,
      projectId: r.projectId,
      instanceId: r.instanceId,
      instanceLabel: r.instanceLabel,
    }));
}

export interface StartRunOpts {
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
}

export function startRun(opts: StartRunOpts): { runId: string } {
  const runId = randomUUID();
  const proc = spawn("claude", opts.args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: opts.cwd,
    env: { ...process.env, PATH: buildAugmentedPath() },
  });
  const run: LiveRun = {
    id: runId,
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
    parseFailures: 0,
    sawStreamDelta: false,
    args: opts.args,
    stderrBuf: "",
    lastActivityAt: Date.now(),
    eventLog: [],
  };
  liveRuns.set(runId, run);

  db.insertRun({
    id: runId,
    agentId: opts.agentId,
    agentName: opts.agentName,
    instanceId: opts.instanceId,
    instanceLabel: opts.instanceLabel,
    projectId: opts.projectId,
    sessionId: undefined,
    status: "running",
    prompt: opts.prompt,
    model: opts.model,
    effort: opts.effort,
    cwd: opts.cwd,
    startedAt: run.startTs,
  });

  log.info("run.start", { runId, agent: opts.agentId, cwd: opts.cwd });

  pumpStdout(run);
  pumpStderr(run);
  // Use 'close' not 'exit': 'exit' fires before stdout finishes draining,
  // so the final 'result' line (which carries session_id) may not be
  // processed yet. 'close' guarantees all stdio streams have ended first.
  proc.on("close", (code) => {
    // If --resume failed because the session no longer exists (different cwd,
    // server restart, etc.), retry once without the --resume flag so the agent
    // starts a fresh session instead of erroring out.
    if (
      code === 1 &&
      run.stderrBuf.includes("No conversation found with session ID") &&
      run.args.includes("--resume")
    ) {
      const resumeIdx = run.args.indexOf("--resume");
      const retryArgs = resumeIdx === -1 ? run.args : [
        ...run.args.slice(0, resumeIdx),
        ...run.args.slice(resumeIdx + 2), // drop "--resume" and the session ID value after it
      ];
      log.info("run.retry_no_resume", { runId: run.id });
      const retryProc = spawn("claude", retryArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: run.cwd,
        env: { ...process.env, PATH: buildAugmentedPath() },
      });
      run.proc = retryProc;
      run.stderrBuf = "";
      pumpStdout(run);
      pumpStderr(run);
      retryProc.on("close", (retryCode) => finalizeRun(run, retryCode ?? 1));
      retryProc.on("error", (err) => {
        broadcast(run, { name: "error", data: { runId: run.id, message: String(err) } });
        if (run.status === "running") finalizeRun(run, 1);
      });
      return;
    }
    finalizeRun(run, code ?? 1);
  });
  proc.on("error", (err) => {
    broadcast(run, { name: "error", data: { runId: run.id, message: String(err) } });
    if (run.status === "running") {
      finalizeRun(run, 1);
    }
  });

  return { runId };
}

export function attachEmit(runId: string, emit: SseEmit): boolean {
  const run = liveRuns.get(runId);
  if (!run) return false;
  run.subscribers.add(emit);
  // Send metadata via `attached` with empty output — the full event log replay
  // below rebuilds the thread in the correct order (chunks interleaved with
  // tool calls), so sending output text here would duplicate it.
  void emit({
    name: "attached",
    data: {
      runId,
      output: "",
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      cost: run.cost,
      status: run.status,
      startTs: run.startTs,
    },
  });
  // Replay all recorded events so the client reconstructs the full thread —
  // including tool groups that fired while no subscriber was watching.
  for (const event of run.eventLog) {
    void emit(event);
  }
  if (run.status !== "running") {
    void emit({
      name: "done",
      data: {
        runId,
        exitCode: run.exitCode ?? 0,
        sessionId: run.sessionId,
        durationMs: run.finishedAt !== undefined ? run.finishedAt - run.startTs : undefined,
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        cost: run.cost,
      },
    });
  }
  return true;
}

export function detachEmit(runId: string, emit: SseEmit): void {
  liveRuns.get(runId)?.subscribers.delete(emit);
}

export function abortRun(runId: string): boolean {
  const run = liveRuns.get(runId);
  if (!run) return false;
  try {
    run.proc.kill();
  } catch {
    /* already exited */
  }
  return true;
}

export function killAllRuns(): void {
  for (const run of liveRuns.values()) {
    try {
      run.proc.kill();
    } catch {
      /* ignore */
    }
    // Defensively finalise here too - `proc.on('exit')` may not get a turn
    // if Node is about to exit. Without this, in-flight runs at SIGINT time
    // never reach runs.log and a refresh later shows "not_found".
    // finalizeRun is idempotent against status checks, so a real exit
    // landing after this is a no-op.
    if (run.status === "running") {
      finalizeRun(run, 130);
    }
  }
}

function broadcast(run: LiveRun, event: SseEvent): void {
  if (event.name === "chunk" || event.name === "tool" || event.name === "usage") {
    run.eventLog.push(event as ReplayableEvent);
  }
  for (const emit of run.subscribers) {
    try {
      void emit(event);
    } catch {
      /* drop bad subscriber on next gc */
    }
  }
}

function pumpStdout(run: LiveRun): void {
  let buf = "";
  run.proc.stdout.on("data", (chunk: Buffer) => {
    run.lastActivityAt = Date.now();
    buf += chunk.toString("utf8");
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) handleStreamLine(run, line);
    }
  });
  run.proc.stdout.on("end", () => {
    if (buf.trim()) handleStreamLine(run, buf.trim());
  });
}

function pumpStderr(run: LiveRun): void {
  run.proc.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    run.stderrBuf += text;
    log.debug("run.stderr", { runId: run.id, text: text.slice(0, 200) });
  });
}

interface StreamEvent {
  type?: string;
  event?: { type?: string; delta?: { type?: string; text?: string }; content_block?: { type?: string; name?: string; input?: unknown } };
  message?: { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>; usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { input_tokens?: number; output_tokens?: number };
  total_cost_usd?: number;
  session_id?: string;
  is_error?: boolean;
  error?: string;
  rate_limit_info?: { status?: string; resetsAt?: number; rateLimitType?: string };
}

function handleStreamLine(run: LiveRun, line: string): void {
  let evt: StreamEvent;
  try {
    evt = JSON.parse(line) as StreamEvent;
  } catch {
    run.parseFailures++;
    if (run.parseFailures <= 3) {
      log.warn("run.unparseable_line", { runId: run.id, line: line.slice(0, 200) });
    }
    return;
  }

  if (evt.type === "stream_event" && evt.event) {
    const ev = evt.event;
    if (
      ev.type === "content_block_delta" &&
      ev.delta?.type === "text_delta" &&
      typeof ev.delta.text === "string"
    ) {
      run.sawStreamDelta = true;
      run.output += ev.delta.text;
      broadcast(run, { name: "chunk", data: { runId: run.id, text: ev.delta.text } });
      return;
    }
    if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use") {
      broadcast(run, {
        name: "tool",
        data: { runId: run.id, name: ev.content_block.name ?? "tool", input: ev.content_block.input },
      });
      db.insertToolCall(run.id, ev.content_block.name ?? "tool", ev.content_block.input, Date.now());
      return;
    }
    return;
  }

  if (evt.type === "assistant" && evt.message?.content) {
    for (const block of evt.message.content) {
      if (block.type === "text" && typeof block.text === "string" && !run.sawStreamDelta) {
        run.output += block.text;
        broadcast(run, { name: "chunk", data: { runId: run.id, text: block.text } });
      } else if (block.type === "tool_use") {
        broadcast(run, {
          name: "tool",
          data: { runId: run.id, name: block.name ?? "tool", input: block.input },
        });
        db.insertToolCall(run.id, block.name ?? "tool", block.input, Date.now());
      }
    }
    if (evt.message.usage) {
      const ti = evt.message.usage.input_tokens;
      const to = evt.message.usage.output_tokens;
      if (typeof ti === "number") run.tokensIn += ti;
      if (typeof to === "number") run.tokensOut += to;
      broadcast(run, {
        name: "usage",
        data: { runId: run.id, tokensIn: run.tokensIn, tokensOut: run.tokensOut, cost: run.cost },
      });
    }
    return;
  }

  if (evt.type === "rate_limit_event") {
    const info = evt.rate_limit_info;
    if (info?.status && info.status !== "allowed") {
      const resetsAt = info.resetsAt;
      run.rateLimitResetsAt = resetsAt;
      const resetMsg = resetsAt
        ? ` Resets at ${new Date(resetsAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}.`
        : "";
      const limitType = info.rateLimitType ? ` (${info.rateLimitType} limit)` : "";
      broadcast(run, {
        name: "error",
        data: { runId: run.id, message: `Rate limited by Anthropic API${limitType}.${resetMsg}` },
      });
      if (run.status === "running") finalizeRun(run, 1);
    }
    return;
  }

  if (evt.type === "result") {
    if (evt.usage) {
      run.tokensIn = evt.usage.input_tokens ?? run.tokensIn;
      run.tokensOut = evt.usage.output_tokens ?? run.tokensOut;
    }
    if (typeof evt.total_cost_usd === "number") run.cost = evt.total_cost_usd;
    if (typeof evt.session_id === "string") run.sessionId = evt.session_id;
    broadcast(run, {
      name: "usage",
      data: { runId: run.id, tokensIn: run.tokensIn, tokensOut: run.tokensOut, cost: run.cost },
    });
    if (evt.is_error) {
      broadcast(run, { name: "error", data: { runId: run.id, message: evt.error || "The agent encountered an error" } });
    }
  }
}

function finalizeRun(run: LiveRun, exitCode: number): void {
  if (run.status !== "running") return;
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
    exitCode: run.exitCode,
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
    sessionId: run.sessionId,
  };

  // Persist best-effort - a DB failure must never swallow the broadcast below.
  try {
    pushRun(persisted);
  } catch (err) {
    log.warn("run.persist_failed", { runId: run.id, err: String(err) });
  }

  try {
    appendHistory({
      key: `${run.agentId}::${run.instanceId ?? "default"}`,
      userContent: run.prompt,
      assistantContent: run.output,
      runId: run.id,
      ts: run.startTs,
    });
  } catch {
    // history write is best-effort - never block finalization
  }

  broadcast(run, {
    name: "done",
    data: {
      runId: run.id,
      exitCode,
      sessionId: run.sessionId,
      durationMs: run.finishedAt - run.startTs,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      cost: run.cost,
    },
  });
}
