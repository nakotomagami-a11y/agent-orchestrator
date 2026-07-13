import { NextResponse } from "next/server";
import { agents, db, history, projects, runs, store, summon } from "@agent-office/domain/services";
import { health } from "@agent-office/domain/services";
import { existsSync, statSync } from "node:fs";
import { paths } from "@agent-office/domain/services";
import { validateBody } from "@/lib/validation";
import { summonRequestSchema } from "@/lib/validation-schemas";
import { badRequest } from "@/lib/api-helpers";
import { parseLimits, periodStart } from "@/lib/claude-limits";

// ─── Route handler ─────────────────────────────────────────────────────────────

type QuotaCheck = { blockResponse?: NextResponse; warning?: string };

function enforceSpendQuota(): QuotaCheck {
  const limits = parseLimits(db.getUiSetting("claude-limits"));
  if (limits.hardCap === "off" || limits.quotaUsd <= 0) return {};
  const spent = db.getSumCostSince(periodStart(limits.period));
  if (limits.hardCap === "block" && spent >= limits.quotaUsd) {
    return {
      blockResponse: NextResponse.json(
        {
          error: "quota_exceeded",
          detail: `${limits.period.charAt(0).toUpperCase() + limits.period.slice(1)} spend cap of $${limits.quotaUsd.toFixed(2)} reached`,
        },
        { status: 402 },
      ),
    };
  }
  if (limits.hardCap === "warn" && spent >= limits.quotaUsd * 0.8) {
    return { warning: `$${spent.toFixed(2)} of $${limits.quotaUsd.toFixed(2)} ${limits.period} budget used` };
  }
  return {};
}

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
  const raw: unknown = await request.json();
  const { data: req, error } = validateBody(summonRequestSchema, raw);
  if (error) return error;

  const claudeStatus = await health.getHealth();
  if (!claudeStatus.available) {
    return NextResponse.json({ error: "claude_unavailable", detail: claudeStatus.error }, { status: 503 });
  }

  const quota = enforceSpendQuota();
  if (quota.blockResponse) return quota.blockResponse;

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
    instanceId: instance?.instanceId,
    instanceLabel,
    args: built.args,
  });

  return NextResponse.json(quota.warning ? { runId, warning: quota.warning } : { runId });
}
