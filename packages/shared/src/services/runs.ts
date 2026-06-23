// Live run registry. Spawns `claude` subprocesses, parses stream-json output,
// and broadcasts events to subscribed SSE writers.
//
// Each subscriber is a callback (`SseEmit`) instead of a websocket - works with
// `apps/web/src/lib/sse.ts` writers and any other consumer.

import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { PersistedRun, SseAttachedEvent, SseChunkEvent, SseDoneEvent, SseErrorEvent, SseRateLimitEvent, SseSubAgentEvent, SseSubAgentUpdateEvent, SseToolEvent, SseUsageEvent, SubAgentStatus, WorkflowNode } from "../types/index";
import { log } from "./log";
import { buildAugmentedPath, resolveClaudeCommand } from "./paths";
import { pushRun } from "./store";
import { appendRun as appendHistory } from "./history";
import * as db from "./db";
import { acquireInhibit, releaseInhibit, forceReleaseInhibit } from "./sleep-inhibit";

export type SseEvent =
  | { name: "attached"; data: SseAttachedEvent }
  | { name: "chunk"; data: SseChunkEvent }
  | { name: "tool"; data: SseToolEvent }
  | { name: "usage"; data: SseUsageEvent }
  | { name: "done"; data: SseDoneEvent }
  | { name: "error"; data: SseErrorEvent }
  | { name: "rate-limit"; data: SseRateLimitEvent }
  | { name: "subagent"; data: SseSubAgentEvent }
  | { name: "subagent-update"; data: SseSubAgentUpdateEvent };

export type SseEmit = (event: SseEvent) => void | Promise<void>;

type ReplayableEvent = Extract<SseEvent, { name: "chunk" | "tool" | "usage" | "subagent" }>;

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
  /** Parent run ID if this is a sub-agent run. */
  parentRunId?: string;
  /** IDs of child runs spawned by Task tool calls. */
  childRunIds: string[];
  /**
   * Sub-agent records keyed by the spawning tool_use id. Lets us correlate the
   * later `tool_result` line back to the sub-agent so we can finalize its card
   * even when the child never registers in `liveRuns` (native Task/Agent and
   * Bash `claude -p` spawns both run outside this process's run registry).
   */
  subAgents: Map<string, SubAgentRecord>;
}

interface SubAgentRecord {
  subRunId: string;
  agentId: string;
  prompt: string;
  startTs: number;
  status: SubAgentStatus;
}

// Hard wall-clock cap. The process is "active" as long as it is alive —
// stdout silence is not inactivity (Claude may be waiting on a long bash tool).
const MAX_WALL_CLOCK_MS = 4 * 60 * 60_000; // 4-hour safety cap

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
    if (run.status === "running" && now - run.startTs > MAX_WALL_CLOCK_MS) {
      log.warn("run.wall_clock_exceeded", { runId: id, wallMs: now - run.startTs });
      broadcast(run, { name: "error", data: { runId: id, message: "Run exceeded maximum runtime of 4 hours." } });
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
    parentRunId: r.parentRunId,
  };
}

/**
 * Build the spawn tree rooted at `rootId` by walking `parentRunId` links in the
 * DB and overlaying in-flight `liveRuns` state (fresher tokens/cost/status for
 * runs still streaming). Depth-capped and cycle-guarded. Returns null when the
 * root run is unknown.
 */
export function buildRunTree(rootId: string, maxDepth = 6): WorkflowNode | null {
  const visited = new Set<string>();

  const toNode = (run: PersistedRun, depth: number): WorkflowNode => {
    visited.add(run.id);
    const live = liveRuns.get(run.id);
    const status = live?.status ?? run.status;
    const durMs = live
      ? (live.status === "running" ? Date.now() - live.startTs : (live.finishedAt ?? Date.now()) - live.startTs)
      : run.durMs;

    const children: WorkflowNode[] =
      depth >= maxDepth
        ? []
        : db
            .getChildRuns(run.id)
            .filter((c) => !visited.has(c.id))
            .map((c) => toNode(c, depth + 1));

    return {
      runId: run.id,
      agentId: run.agentId,
      agentName: run.agentName,
      status,
      prompt: run.prompt,
      startTs: run.ts,
      durMs,
      tokensIn: live?.tokensIn ?? run.tokensIn,
      tokensOut: live?.tokensOut ?? run.tokensOut,
      cost: live?.cost ?? run.cost,
      children,
    };
  };

  const root = getLiveRunAsPersistedRun(rootId) ?? db.getRun(rootId);
  if (!root) return null;
  return toNode(root, 0);
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
  parentRunId?: string;
}

export function startRun(opts: StartRunOpts): { runId: string } {
  const runId = randomUUID();
  // shell:true only as a last-resort fallback — needed for .cmd files on
  // Windows but it routes through cmd.exe whose quoting corrupts multi-line
  // arguments like --append-system-prompt. resolveClaudeCommand() prefers
  // the real .exe so we can avoid the shell.
  const cmd = resolveClaudeCommand();
  const useShell = process.platform === "win32" && cmd.toLowerCase().endsWith(".cmd");
  const proc = spawn(cmd, opts.args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: opts.cwd,
    env: { ...process.env, PATH: buildAugmentedPath() },
    shell: useShell,
    windowsVerbatimArguments: false,
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
    parentRunId: opts.parentRunId,
    childRunIds: [],
    subAgents: new Map(),
  };
  liveRuns.set(runId, run);
  acquireInhibit();

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
    parentRunId: opts.parentRunId,
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
      const retryCmd = resolveClaudeCommand();
      const retryUseShell = process.platform === "win32" && retryCmd.toLowerCase().endsWith(".cmd");
      const retryProc = spawn(retryCmd, retryArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: run.cwd,
        env: { ...process.env, PATH: buildAugmentedPath() },
        shell: retryUseShell,
        windowsVerbatimArguments: false,
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
  forceReleaseInhibit();
}

function broadcast(run: LiveRun, event: SseEvent): void {
  if (event.name === "chunk" || event.name === "tool" || event.name === "usage" || event.name === "subagent") {
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
  message?: { content?: Array<{ type: string; id?: string; text?: string; name?: string; input?: unknown; tool_use_id?: string; content?: unknown; is_error?: boolean }>; usage?: { input_tokens?: number; output_tokens?: number } };
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
      const toolName = ev.content_block.name ?? "tool";
      broadcast(run, {
        name: "tool",
        data: { runId: run.id, name: toolName, input: ev.content_block.input },
      });
      db.insertToolCall(run.id, toolName, ev.content_block.input, Date.now());
      // Do NOT call spawnSubAgentRecord here — input is always {} at content_block_start.
      // Sub-agent records are created in the assistant event handler where input is complete.
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
        const toolName = block.name ?? "tool";
        // Phase-0 ground-truth probe. Enable with AO_DEBUG_TOOLS=1 to capture the
        // exact tool name / input shape the installed Claude CLI emits for spawns.
        if (process.env.AO_DEBUG_TOOLS) {
          log.info("tool.debug", { runId: run.id, name: toolName, input: block.input });
        }
        broadcast(run, {
          name: "tool",
          data: { runId: run.id, name: toolName, input: block.input },
        });
        db.insertToolCall(run.id, toolName, block.input, Date.now());
        const spawn = detectSubAgentSpawn(toolName, block.input, run.agentId);
        if (spawn) {
          spawnSubAgentRecord(run, block.id, spawn);
        }
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

  // `user` events carry tool_result blocks. A result for a tool_use that spawned
  // a sub-agent is the terminal signal for that sub-agent's card (native Task /
  // Agent and Bash `claude -p` children run outside liveRuns, so the live bridge
  // never fires for them).
  if (evt.type === "user" && evt.message?.content) {
    for (const block of evt.message.content) {
      if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
        finalizeSubAgentFromResult(run, block.tool_use_id, block);
      }
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
      // Broadcast a warning — do NOT kill the run. The user decides to stop or
      // continue; the CLI will exit on its own if Anthropic hard-blocks it.
      broadcast(run, {
        name: "rate-limit",
        data: { runId: run.id, message: `Rate limited by Anthropic API${limitType}.${resetMsg}`, resetsAt },
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
    if (typeof evt.session_id === "string") run.sessionId = evt.session_id;
    broadcast(run, {
      name: "usage",
      data: { runId: run.id, tokensIn: run.tokensIn, tokensOut: run.tokensOut, cost: run.cost },
    });
    if (evt.is_error) {
      // evt.error is blank for some Anthropic API errors (e.g. image-dimension limit).
      // In those cases the real message was already streamed as a text chunk, so fall
      // back to the last non-empty paragraph from the run's accumulated output.
      const lastParagraph = run.output.trim().split(/\n{2,}/).at(-1)?.trim() ?? "";
      const message = evt.error || lastParagraph || "The agent encountered an error";
      broadcast(run, { name: "error", data: { runId: run.id, message } });
    }
  }
}

function extractTaskPrompt(input: unknown): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    if (typeof obj.prompt === "string") return obj.prompt.trim();
    if (typeof obj.description === "string") return obj.description.trim();
  }
  if (typeof input === "string") return input.trim();
  return JSON.stringify(input);
}

const SUB_AGENT_THROTTLE_MS = 500;

function bridgeChildToParent(parentRun: LiveRun, subRunId: string): void {
  const childRun = liveRuns.get(subRunId);
  if (!childRun) return;

  let lastEmitTs = 0;

  const emit: SseEmit = (event) => {
    if (event.name === "chunk" || event.name === "tool" || event.name === "usage" || event.name === "done" || event.name === "error") {
      const now = Date.now();
      const status: SubAgentStatus =
        event.name === "done"
          ? (event.data as { exitCode: number }).exitCode === 0 ? "done" : "error"
          : event.name === "error"
            ? "error"
            : childRun.status === "running" ? "running" : "done";

      const lastLine = childRun.output
        ? childRun.output.trimEnd().split("\n").pop()?.trim() ?? undefined
        : undefined;

      const currentTool = event.name === "tool"
        ? (event.data as { name: string }).name
        : undefined;

      const isDone = event.name === "done" || event.name === "error";

      if (!isDone && now - lastEmitTs < SUB_AGENT_THROTTLE_MS) return;
      lastEmitTs = now;

      broadcast(parentRun, {
        name: "subagent-update",
        data: {
          type: "subagent-update",
          subRunId,
          status,
          currentTool,
          tokensIn: childRun.tokensIn,
          tokensOut: childRun.tokensOut,
          cost: childRun.cost,
          lastOutputLine: lastLine,
        },
      });

      if (isDone) {
        childRun.subscribers.delete(emit);
      }
    }
  };

  childRun.subscribers.add(emit);
}

function extractChildAgentId(input: unknown, fallback: string): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    if (typeof obj.subagent_type === "string" && obj.subagent_type) return obj.subagent_type;
  }
  return fallback;
}

/** Tool names that always denote a sub-agent spawn in the current Claude CLI. */
const SUB_AGENT_TOOL_NAMES = new Set(["Task", "Agent"]);

/**
 * Single source of truth for "did this tool call spawn a sub-agent?". Matches
 * three summon styles so a card is created in exactly one place:
 *   1. Native Task/Agent tool (known name, or structural `subagent_type` /
 *      `description`+`prompt` shape so it survives future tool renames).
 *   2. Bash `claude -p --agent <id> "<prompt>"` spawns.
 * Returns the resolved child agent id + prompt, or null when it is an ordinary
 * tool call.
 */
export function detectSubAgentSpawn(
  toolName: string,
  input: unknown,
  fallbackAgentId: string,
): { agentId: string; prompt: string } | null {
  const obj =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;

  const structural =
    !!obj &&
    (typeof obj.subagent_type === "string" ||
      (typeof obj.description === "string" && typeof obj.prompt === "string"));

  if (SUB_AGENT_TOOL_NAMES.has(toolName) || structural) {
    return {
      agentId: extractChildAgentId(input, fallbackAgentId),
      prompt: extractTaskPrompt(input),
    };
  }

  if (toolName === "Bash" && obj && typeof obj.command === "string") {
    const parsed = parseClaudeBashSpawn(obj.command);
    if (parsed) {
      return { agentId: parsed.agentId ?? fallbackAgentId, prompt: parsed.prompt };
    }
  }

  return null;
}

/**
 * Parse a Bash command that shells out to the Claude CLI in non-interactive
 * print mode (`claude -p` / `--print`) with an `--agent <id>`. Returns null for
 * any Bash command that is not such a spawn.
 */
export function parseClaudeBashSpawn(
  command: string,
): { agentId?: string; prompt: string } | null {
  if (!/(^|[\s;&|(])claude(\s|$)/.test(command)) return null;
  if (!/(^|\s)(-p|--print)(\s|=|$)/.test(command)) return null;

  const agentMatch = command.match(/--agent(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/);
  const agentId = agentMatch ? (agentMatch[1] ?? agentMatch[2] ?? agentMatch[3]) : undefined;

  return { agentId, prompt: extractBashPrompt(command) };
}

function extractBashPrompt(command: string): string {
  const pFlag = command.match(/(?:-p|--print)(?:\s+|=)(?:"([^"]*)"|'([^']*)')/);
  if (pFlag) return (pFlag[1] ?? pFlag[2] ?? "").trim();
  // Otherwise the last quoted string in the command is usually the prompt.
  const quotes = [...command.matchAll(/"([^"]*)"|'([^']*)'/g)];
  const last = quotes.at(-1);
  if (last) return (last[1] ?? last[2] ?? "").trim();
  return command.trim();
}

function spawnSubAgentRecord(
  parentRun: LiveRun,
  toolUseId: string | undefined,
  spawn: { agentId: string; prompt: string },
): void {
  const subRunId = randomUUID();
  const { agentId: childAgentId, prompt } = spawn;
  const startTs = Date.now();

  parentRun.childRunIds.push(subRunId);
  if (toolUseId) {
    parentRun.subAgents.set(toolUseId, { subRunId, agentId: childAgentId, prompt, startTs, status: "running" });
  }

  // Insert a placeholder row so the run detail page can be navigated to.
  try {
    db.insertRun({
      id: subRunId,
      agentId: childAgentId,
      agentName: childAgentId,
      instanceId: parentRun.instanceId,
      instanceLabel: parentRun.instanceLabel,
      projectId: parentRun.projectId,
      sessionId: undefined,
      status: "running",
      prompt,
      model: parentRun.model,
      effort: parentRun.effort,
      cwd: parentRun.cwd,
      startedAt: startTs,
      parentRunId: parentRun.id,
    });
  } catch (err) {
    log.warn("subagent.insert_failed", { parentRunId: parentRun.id, err: String(err) });
  }

  broadcast(parentRun, {
    name: "subagent",
    data: {
      type: "subagent",
      parentRunId: parentRun.id,
      subRunId,
      agentId: childAgentId,
      prompt,
      status: "running",
    },
  });

  // Attempt to bridge if the child run is already live (unlikely at this point,
  // but possible if the same process created it). Normally the child registers
  // itself into liveRuns via its own startRun call after we emit the event.
  bridgeChildToParent(parentRun, subRunId);
}

/**
 * Terminal update for a sub-agent driven by the parent stream's `tool_result`.
 * This is the only completion signal for native Task/Agent and Bash children,
 * which never register in `liveRuns` so `bridgeChildToParent` stays dormant.
 */
function finalizeSubAgentFromResult(
  parentRun: LiveRun,
  toolUseId: string,
  block: { content?: unknown; is_error?: boolean },
): void {
  const record = parentRun.subAgents.get(toolUseId);
  if (!record || record.status !== "running") return;

  const output = stringifyToolResult(block.content);
  const lastLine = output ? output.trimEnd().split("\n").pop()?.trim() || undefined : undefined;
  const status: SubAgentStatus = block.is_error ? "error" : "done";
  record.status = status;

  try {
    db.updateRun(record.subRunId, {
      status: status === "done" ? "done" : "error",
      exitCode: status === "done" ? 0 : 1,
      output,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      durMs: Math.max(0, Date.now() - record.startTs),
      endedAt: Date.now(),
    });
  } catch (err) {
    log.warn("subagent.finalize_failed", { subRunId: record.subRunId, err: String(err) });
  }

  broadcast(parentRun, {
    name: "subagent-update",
    data: {
      type: "subagent-update",
      subRunId: record.subRunId,
      status,
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      lastOutputLine: lastLine,
    },
  });
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return typeof part === "string" ? part : "";
      })
      .join("");
  }
  if (content == null) return "";
  return typeof content === "object" ? JSON.stringify(content) : String(content);
}

function finalizeRun(run: LiveRun, exitCode: number): void {
  if (run.status !== "running") return;
  run.status = exitCode === 0 ? "done" : "error";
  run.exitCode = exitCode;
  run.finishedAt = Date.now();
  releaseInhibit();

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
    parentRunId: run.parentRunId,
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
