// Build the `claude -p` arg list for a summon, applying instance + agent defaults.

import { homedir } from "node:os";
import type { AgentInstance, ApiAgent, SummonRequest } from "../types/index";

export interface BuiltCommand {
  args: string[];
  model: string;
  effort: string;
  permissionMode?: string;
}

export function buildClaudeArgs(opts: {
  request: SummonRequest;
  agent: ApiAgent;
  instance: AgentInstance | null;
  appendedSystemPrompt: string;
  priorContext?: string;
}): BuiltCommand {
  const { request, agent, instance, appendedSystemPrompt, priorContext } = opts;

  const args = [
    "-p",
    "--agent",
    request.agentId,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
  ];

  const model = request.model ?? instance?.model ?? agent.defaultModel ?? "default";
  const effort = request.effort ?? instance?.effort ?? agent.defaultEffort ?? "default";
  const permissionMode = instance?.permissionMode ?? agent.permissionMode;

  if (model && model !== "default") args.push("--model", model);
  if (effort && effort !== "default") args.push("--effort", effort);
  if (request.maxBudgetUsd && request.maxBudgetUsd > 0) {
    args.push("--max-budget-usd", String(request.maxBudgetUsd));
  }
  if (permissionMode) args.push("--permission-mode", permissionMode);
  for (const dir of agent.addDirs ?? []) {
    args.push("--add-dir", dir.replace(/^~/, homedir()));
  }
  if (appendedSystemPrompt) args.push("--append-system-prompt", appendedSystemPrompt);
  if (request.resumeSessionId) args.push("--resume", request.resumeSessionId);

  args.push(priorContext ? priorContext + request.prompt : request.prompt);

  return { args, model, effort, permissionMode };
}
