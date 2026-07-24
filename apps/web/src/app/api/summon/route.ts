import { NextResponse } from "next/server";
import { agents, history, projects, runs, store, summon } from "@agent-office/domain/services";
import { health } from "@agent-office/domain/services";
import { existsSync, statSync } from "node:fs";
import { paths } from "@agent-office/domain/services";
import { validateBody } from "@/lib/validation";
import { summonRequestSchema } from "@/lib/validation-schemas";
import { badRequest, serverError } from "@/lib/api-helpers";
import { log } from "@agent-office/domain/services/log";

// ─── Route handler ─────────────────────────────────────────────────────────────

type ResolvedCwd = { cwd?: string } | { error: NextResponse };

function resolveSummonCwdOrError(project: ReturnType<typeof projects.readProject> | null, instance: ReturnType<typeof projects.findInstance>, requestCwd: string | undefined): ResolvedCwd {
  const instanceCwd = projects.resolveInstanceCwd(project, instance);
  const requestedCwd = instanceCwd ?? projects.resolveSummonCwd(requestCwd, project);
  if (!requestedCwd) return { cwd: undefined };
  const expanded = paths.expandTilde(requestedCwd);
  if (!existsSync(expanded) || !statSync(expanded).isDirectory()) {
    return { error: badRequest(`cwd not a directory: ${requestedCwd}`) };
  }
  return { cwd: expanded };
}

type ContextProfile = "tight" | "balanced" | "deep";

function buildPriorContext(req: { agentId: string; instanceId?: string; projectId?: string; prompt: string; resumeSessionId?: string; contextProfile?: ContextProfile }): { priorContext?: string; hasMessages: boolean } {
  if (req.resumeSessionId) return { hasMessages: false };
  const profile: ContextProfile = req.contextProfile ?? "balanced";
  const msgs = history.getContextMessages({
    agentId: req.agentId,
    instanceId: req.instanceId ?? "default",
    projectId: req.projectId,
    profile,
    currentPrompt: req.prompt,
  });
  if (msgs.length === 0) return { hasMessages: false };
  return { hasMessages: true, priorContext: history.formatPriorContext(msgs, profile) };
}

export async function POST(request: Request) {
  try {
    return await summonRun(request);
  } catch (e) {
    // Without this the throw becomes Next's bodyless 500, which the client
    // renders as the useless "Internal Server Error" and leaves no trace on
    // disk. Surface the real message and record it.
    const err = e instanceof Error ? e : new Error(String(e));
    log.error("summon.failed", { message: err.message, stack: err.stack });
    return serverError(err.message);
  }
}

async function summonRun(request: Request) {
  const raw: unknown = await request.json();
  const { data: req, error } = validateBody(summonRequestSchema, raw);
  if (error) return error;

  const claudeStatus = await health.getHealth();
  if (!claudeStatus.available) {
    return NextResponse.json({ error: "claude_unavailable", detail: claudeStatus.error }, { status: 503 });
  }

  const agent = agents.readAgent(req.agentId);
  if (!agent) return badRequest(`unknown agent: ${req.agentId}`);

  const project = req.projectId ? projects.readProject(req.projectId) : null;
  const instance = projects.findInstance(project, req.instanceId);

  const cwdResolution = resolveSummonCwdOrError(project, instance, req.cwd);
  if ("error" in cwdResolution) return cwdResolution.error;

  const { priorContext, hasMessages } = buildPriorContext(req);
  const appendedSystemPrompt = agents.buildAppendedPrompt(req.agentId, project, req.instanceId, hasMessages);

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
    cwd: cwdResolution.cwd,
    projectId: req.projectId,
    instanceId: req.instanceId ?? instance?.instanceId,
    instanceLabel,
    args: built.args,
  });

  return NextResponse.json({ runId });
}
