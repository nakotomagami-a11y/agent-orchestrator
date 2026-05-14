import { NextResponse } from "next/server";
import { agents, history, projects, runs, store, summon } from "@agent-office/shared/services";
import { health } from "@agent-office/shared/services";
import { existsSync, statSync } from "node:fs";
import { paths } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { summonRequestSchema } from "@/lib/validation-schemas";
import { badRequest } from "@/lib/api-helpers";

export async function POST(request: Request) {
  const raw: unknown = await request.json();
  const { data: req, error } = validateBody(summonRequestSchema, raw);
  if (error) return error;

  const claudeStatus = await health.getHealth();
  if (!claudeStatus.available) {
    return NextResponse.json(
      { error: "claude_unavailable", detail: claudeStatus.error },
      { status: 503 },
    );
  }

  const agent = agents.readAgent(req.agentId);
  if (!agent) return badRequest(`unknown agent: ${req.agentId}`);

  const project = req.projectId ? projects.readProject(req.projectId) : null;
  const instance = projects.findInstance(project, req.instanceId);

  let cwd: string | undefined;
  const requestedCwd = projects.resolveSummonCwd(req.cwd, project);
  if (requestedCwd) {
    const expanded = paths.expandTilde(requestedCwd);
    if (!existsSync(expanded) || !statSync(expanded).isDirectory()) {
      return badRequest(`cwd not a directory: ${requestedCwd}`);
    }
    cwd = expanded;
  }

  const appendedSystemPrompt = agents.buildAppendedPrompt(req.agentId, project, req.instanceId);

  let priorContext: string | undefined;
  if (!req.resumeSessionId) {
    const recentMsgs = history.getRecentMessages(`${req.agentId}::${req.instanceId ?? "default"}`, 8);
    if (recentMsgs.length > 0) priorContext = history.formatPriorContext(recentMsgs);
  }

  const built = summon.buildClaudeArgs({
    request: req,
    agent: agent.info,
    instance,
    appendedSystemPrompt,
    priorContext,
  });

  store.pushRecentPrompt(req.agentId, req.prompt);

  const instanceLabel = instance?.label ?? (instance ? agent.info.name : undefined);
  const { runId } = runs.startRun({
    agentId: req.agentId,
    agentName: instanceLabel ?? agent.info.name,
    prompt: req.prompt,
    model: built.model,
    effort: built.effort,
    cwd,
    projectId: req.projectId,
    instanceId: instance?.instanceId,
    instanceLabel,
    args: built.args,
  });

  return NextResponse.json({ runId });
}
