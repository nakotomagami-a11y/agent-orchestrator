// In-memory thread item shapes built from SSE events. The chat panel renders
// these directly — keeping them denormalised here means components don't have
// to know anything about the wire format.

export type ThreadItem =
  | { kind: "you"; id: string; text: string }
  | { kind: "agent-text"; id: string; text: string; streaming: boolean }
  | { kind: "agent-tool"; id: string; name: string; arg?: string }
  | { kind: "agent-thinking"; id: string; text: string }
  | { kind: "agent-subagent"; id: string; name: string; prompt: string; status: "running" | "done" | "error"; startTs: number; durationMs?: number }
  | { kind: "system-error"; id: string; message: string }
  | { kind: "system-done"; id: string; exitCode: number };

export interface UsageMeter {
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export type RunPhase = "idle" | "starting" | "streaming" | "done" | "error";
