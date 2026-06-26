import { NextResponse } from "next/server";
import { agents, db, history, projects, runs, store, summon } from "@agent-office/shared/services";
import { health } from "@agent-office/shared/services";
import { existsSync, statSync } from "node:fs";
import { paths } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { summonRequestSchema } from "@/lib/validation-schemas";
import { badRequest } from "@/lib/api-helpers";
import { parseLimits, periodStart } from "@/lib/claude-limits";

// ─── Route handler ─────────────────────────────────────────────────────────────

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

  // ── Quota enforcement ──────────────────────────────────────────────────────
  const limits = parseLimits(db.getUiSetting("claude-limits"));
  let warning: string | undefined;
  if (limits.hardCap !== "off" && limits.quotaUsd > 0) {
    const spent = db.getSumCostSince(periodStart(limits.period));
    if (limits.hardCap === "block" && spent >= limits.quotaUsd) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          detail: `${limits.period.charAt(0).toUpperCase() + limits.period.slice(1)} spend cap of $${limits.quotaUsd.toFixed(2)} reached`,
        },
        { status: 402 },
      );
    }
    if (limits.hardCap === "warn" && spent >= limits.quotaUsd * 0.8) {
      warning = `$${spent.toFixed(2)} of $${limits.quotaUsd.toFixed(2)} ${limits.period} budget used`;
    }
  }

  const agent = agents.readAgent(req.agentId);
  if (!agent) return badRequest(`unknown agent: ${req.agentId}`);

  const project = req.projectId ? projects.readProject(req.projectId) : null;
  const instance = projects.findInstance(project, req.instanceId);

  let cwd: string | undefined;
  // Prefer the instance worktree (self-healing: recreates a missing worktree or
  // clears a dead pin so it falls back to the shared cwd), then the explicit
  // request cwd, and finally project.meta.cwd.
  const instanceCwd = projects.resolveInstanceCwd(project, instance);
  const requestedCwd = instanceCwd ?? projects.resolveSummonCwd(req.cwd, project);
  if (requestedCwd) {
    const expanded = paths.expandTilde(requestedCwd);
    if (!existsSync(expanded) || !statSync(expanded).isDirectory()) {
      return badRequest(`cwd not a directory: ${requestedCwd}`);
    }
    cwd = expanded;
  }

  const profile = req.contextProfile ?? "balanced";

  let priorContext: string | undefined;
  let hasMessages = false;
  if (!req.resumeSessionId) {
    const msgs = history.getContextMessages({
      agentId: req.agentId,
      instanceId: req.instanceId ?? "default",
      projectId: req.projectId,
      profile,
      currentPrompt: req.prompt,
    });
    if (msgs.length > 0) {
      hasMessages = true;
      priorContext = history.formatPriorContext(msgs, profile);
    }
  }

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
    cwd,
    projectId: req.projectId,
    instanceId: instance?.instanceId,
    instanceLabel,
    args: built.args,
  });

  return NextResponse.json(warning ? { runId, warning } : { runId });
}
