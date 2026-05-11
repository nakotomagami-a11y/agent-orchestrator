// Live run registry. Spawns `claude` subprocesses, parses stream-json output,
// and broadcasts events to subscribed SSE writers.
//
// Each subscriber is a callback (`SseEmit`) instead of a websocket — works with
// `apps/web/src/lib/sse.ts` writers and any other consumer.

import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { PersistedRun, SseAttachedEvent, SseChunkEvent, SseDoneEvent, SseErrorEvent, SseToolEvent, SseUsageEvent } from "../types/index";
import { log } from "./log";
import { pushRun } from "./store";

export type SseEvent =
  | { name: "attached"; data: SseAttachedEvent }
  | { name: "chunk"; data: SseChunkEvent }
  | { name: "tool"; data: SseToolEvent }
  | { name: "usage"; data: SseUsageEvent }
  | { name: "done"; data: SseDoneEvent }
  | { name: "error"; data: SseErrorEvent };

export type SseEmit = (event: SseEvent) => void | Promise<void>;

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
  proc: ChildProcessByStdio<null, Readable, Readable>;
  subscribers: Set<SseEmit>;
  finishedAt?: number;
  parseFailures: number;
  sawStreamDelta: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __agentOfficeLiveRuns: Map<string, LiveRun> | undefined;
  // eslint-disable-next-line no-var
  var __agentOfficeRunsInstalled: boolean | undefined;
}

const liveRuns: Map<string, LiveRun> =
  globalThis.__agentOfficeLiveRuns ??
  (globalThis.__agentOfficeLiveRuns = new Map());

const RUN_RETENTION_MS = 5 * 60_000;

function gc(): void {
  const cutoff = Date.now() - RUN_RETENTION_MS;
  for (const [id, run] of liveRuns) {
    if (run.status !== "running" && (run.finishedAt ?? 0) < cutoff) {
      liveRuns.delete(id);
    }
  }
}

if (!globalThis.__agentOfficeRunsInstalled) {
  setInterval(gc, 60_000).unref();
  process.on("SIGINT", () => {
    killAllRuns();
  });
  process.on("SIGTERM", () => {
    killAllRuns();
  });
  globalThis.__agentOfficeRunsInstalled = true;
}

export function getLiveRun(runId: string): LiveRun | undefined {
  return liveRuns.get(runId);
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
  };
  liveRuns.set(runId, run);

  log.info("run.start", { runId, agent: opts.agentId, cwd: opts.cwd });

  pumpStdout(run);
  pumpStderr(run);
  proc.on("exit", (code) => finalizeRun(run, code ?? 1));
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
  void emit({
    name: "attached",
    data: {
      runId,
      output: run.output,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      cost: run.cost,
      status: run.status,
      startTs: run.startTs,
    },
  });
  if (run.status !== "running") {
    void emit({ name: "done", data: { runId, exitCode: run.exitCode ?? 0 } });
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
    // Defensively finalise here too — `proc.on('exit')` may not get a turn
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
    log.debug("run.stderr", { runId: run.id, text: chunk.toString("utf8").slice(0, 200) });
  });
}

interface StreamEvent {
  type?: string;
  event?: { type?: string; delta?: { type?: string; text?: string }; content_block?: { type?: string; name?: string; input?: unknown } };
  message?: { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>; usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { input_tokens?: number; output_tokens?: number };
  total_cost_usd?: number;
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
      }
    }
    if (evt.message.usage) {
      const ti = evt.message.usage.input_tokens;
      const to = evt.message.usage.output_tokens;
      if (typeof ti === "number") run.tokensIn = ti;
      if (typeof to === "number") run.tokensOut = to;
      broadcast(run, {
        name: "usage",
        data: { runId: run.id, tokensIn: run.tokensIn, tokensOut: run.tokensOut, cost: run.cost },
      });
    }
    return;
  }

  if (evt.type === "result") {
    if (evt.usage) {
      run.tokensIn = evt.usage.input_tokens ?? run.tokensIn;
      run.tokensOut = evt.usage.output_tokens ?? run.tokensOut;
    }
    if (typeof evt.total_cost_usd === "number") run.cost = evt.total_cost_usd;
    broadcast(run, {
      name: "usage",
      data: { runId: run.id, tokensIn: run.tokensIn, tokensOut: run.tokensOut, cost: run.cost },
    });
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
  };
  pushRun(persisted);

  broadcast(run, { name: "done", data: { runId: run.id, exitCode } });
}
