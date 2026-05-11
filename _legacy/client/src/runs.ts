// Reducer for run state — keeps App.tsx clean.

import { useEffect, useReducer } from "react";
import { fmtDur } from "./helpers";
import type { Run, RunStatus, OutputSegment } from "./types";

interface State {
  runs: Record<string, Run>;
  selectedByAgent: Record<string, string | null>;
}

export const initialRunsState: State = { runs: {}, selectedByAgent: {} };

export type Action =
  | { type: "start"; run: Run }
  | { type: "chunk"; runId: string; text: string }
  | { type: "tool"; runId: string; toolName: string; toolInput?: unknown }
  | { type: "usage"; runId: string; tokensIn: number; tokensOut: number; cost: number }
  | { type: "status"; runId: string; status: RunStatus }
  | { type: "errorMessage"; runId: string; message: string }
  | { type: "close"; runId: string }
  | { type: "select"; agentId: string; runId: string | null }
  | { type: "attached"; runId: string; output: string; tokensIn: number; tokensOut: number; cost: number; status: RunStatus }
  | { type: "tick" };

function setRun(state: State, runId: string, update: Partial<Run>): State {
  const cur = state.runs[runId];
  if (!cur) return state;
  return { ...state, runs: { ...state.runs, [runId]: { ...cur, ...update } } };
}

export function runsReducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return {
        runs: { ...state.runs, [action.run.id]: action.run },
        selectedByAgent: { ...state.selectedByAgent, [action.run.agentId]: action.run.id },
      };

    case "chunk": {
      const cur = state.runs[action.runId];
      if (!cur) return state;
      const segs = [...cur.segments];
      const last = segs[segs.length - 1];
      if (last && last.kind === "text") {
        segs[segs.length - 1] = { ...last, text: (last.text ?? "") + action.text };
      } else {
        segs.push({ kind: "text", text: action.text });
      }
      return setRun(state, action.runId, { segments: segs });
    }

    case "tool": {
      const cur = state.runs[action.runId];
      if (!cur) return state;
      const seg: OutputSegment = { kind: "tool", toolName: action.toolName, toolInput: action.toolInput };
      return setRun(state, action.runId, { segments: [...cur.segments, seg] });
    }

    case "usage":
      return setRun(state, action.runId, {
        tokensIn: action.tokensIn,
        tokensOut: action.tokensOut,
        cost: action.cost,
      });

    case "status":
      return setRun(state, action.runId, { status: action.status });

    case "errorMessage": {
      const cur = state.runs[action.runId];
      if (!cur) return state;
      return setRun(state, action.runId, {
        segments: [...cur.segments, { kind: "text", text: "\n\n[error] " + action.message }],
        status: "error",
      });
    }

    case "close": {
      const newRuns = { ...state.runs };
      delete newRuns[action.runId];
      const newSel = { ...state.selectedByAgent };
      for (const k of Object.keys(newSel)) if (newSel[k] === action.runId) newSel[k] = null;
      return { runs: newRuns, selectedByAgent: newSel };
    }

    case "select":
      return { ...state, selectedByAgent: { ...state.selectedByAgent, [action.agentId]: action.runId } };

    case "attached": {
      // Reattaching to an already-running run — replace state with what server has
      const cur = state.runs[action.runId];
      if (!cur) return state;
      return setRun(state, action.runId, {
        segments: [{ kind: "text", text: action.output }],
        tokensIn: action.tokensIn,
        tokensOut: action.tokensOut,
        cost: action.cost,
        status: action.status,
      });
    }

    case "tick": {
      const newRuns: Record<string, Run> = {};
      let changed = false;
      for (const [id, r] of Object.entries(state.runs)) {
        if (r.status === "running") {
          const elapsed = Date.now() - r.ts;
          newRuns[id] = { ...r, durMs: elapsed, elapsedStr: fmtDur(elapsed) };
          changed = true;
        } else newRuns[id] = r;
      }
      return changed ? { ...state, runs: newRuns } : state;
    }
  }
}

export function useRunsState() {
  const [state, dispatch] = useReducer(runsReducer, initialRunsState);

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, []);

  return [state, dispatch] as const;
}

// Persisted active runs (sessionStorage) — used to reattach on page reload.
const ACTIVE_RUNS_KEY = "agent-office:active-runs";

interface ActiveRunStub {
  runId: string;
  agentId: string;
  agentName: string;
  ts: number;
  prompt: string;
  model: string;
  effort: string;
  cwd?: string;
}

export function rememberActive(stub: ActiveRunStub) {
  try {
    const cur = JSON.parse(sessionStorage.getItem(ACTIVE_RUNS_KEY) ?? "[]") as ActiveRunStub[];
    const next = [stub, ...cur.filter(r => r.runId !== stub.runId)].slice(0, 20);
    sessionStorage.setItem(ACTIVE_RUNS_KEY, JSON.stringify(next));
  } catch {}
}

export function forgetActive(runId: string) {
  try {
    const cur = JSON.parse(sessionStorage.getItem(ACTIVE_RUNS_KEY) ?? "[]") as ActiveRunStub[];
    sessionStorage.setItem(ACTIVE_RUNS_KEY, JSON.stringify(cur.filter(r => r.runId !== runId)));
  } catch {}
}

export function loadActiveStubs(maxAgeMs = 30 * 60_000): ActiveRunStub[] {
  try {
    const cur = JSON.parse(sessionStorage.getItem(ACTIVE_RUNS_KEY) ?? "[]") as ActiveRunStub[];
    const cutoff = Date.now() - maxAgeMs;
    return cur.filter(r => r.ts > cutoff);
  } catch { return []; }
}
