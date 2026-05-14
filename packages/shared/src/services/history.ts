import { homedir } from "node:os";
import { DB_PATH } from "./paths";
import * as db from "./db";

export type { HistoryMessage } from "./db";

export function appendRun(opts: {
  key: string;
  userContent: string;
  assistantContent: string;
  runId: string;
  ts: number;
}): void {
  const [agentId, ...rest] = opts.key.split("::");
  const instanceId = rest.join("::") || "default";
  db.insertMessages({
    runId: opts.runId,
    agentId: agentId ?? opts.key,
    instanceId,
    userContent: opts.userContent,
    assistantContent: opts.assistantContent,
    ts: opts.ts,
  });
}

export function getRecentMessages(key: string, limit = 8): db.HistoryMessage[] {
  const [agentId, ...rest] = key.split("::");
  const instanceId = rest.join("::") || "default";
  return db.getRecentMessages(agentId ?? key, instanceId, limit);
}

export function formatPriorContext(messages: db.HistoryMessage[]): string {
  if (messages.length === 0) return "";
  const TRUNCATE = 500;
  const body = messages
    .map((m) => {
      const label = m.role === "user" ? "User" : "Assistant";
      const content = m.content.length > TRUNCATE
        ? m.content.slice(0, TRUNCATE) + "… [truncated]"
        : m.content;
      return `${label}: ${content}`;
    })
    .join("\n\n");
  return `[Prior conversation — ${messages.length} most recent messages]\n${body}\n[End prior context]\n\n`;
}

export function historyNote(agentId: string, instanceId: string): string {
  const dbPath = DB_PATH.replace(homedir(), "~");
  return `${dbPath} — query: sqlite3 "${dbPath}" "SELECT role, content FROM messages WHERE agent_id='${agentId}' AND instance_id='${instanceId}' ORDER BY ts DESC LIMIT 20"`;
}
