import { NextResponse } from "next/server";
import { agents, db, history, projects, runs, store, summon } from "@agent-office/shared/services";
import { health } from "@agent-office/shared/services";
import { existsSync, statSync } from "node:fs";
import { paths } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { summonRequestSchema } from "@/lib/validation-schemas";
import { badRequest } from "@/lib/api-helpers";

// ─── Quota helpers (server-side, no zustand dependency) ───────────────────────

type LimitsPeriod = "daily" | "week" | "month";
type HardCap = "off" | "warn" | "block";

interface ClaudeLimits {
  quotaUsd: number;
  period: LimitsPeriod;
  hardCap: HardCap;
}

function parseLimitsRaw(raw: string | null): ClaudeLimits {
  const DEFAULTS: ClaudeLimits = { quotaUsd: 0, period: "week", hardCap: "warn" };
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const period: LimitsPeriod =
      parsed.period === "month" ? "month" :
      parsed.period === "daily" ? "daily" :
      "week";
    const hardCap: HardCap =
      parsed.hardCap === "off" || parsed.hardCap === "warn" || parsed.hardCap === "block"
        ? (parsed.hardCap as HardCap)
        : DEFAULTS.hardCap;
    const quotaUsd =
      typeof parsed.quotaUsd === "number" && parsed.quotaUsd >= 0 ? parsed.quotaUsd : DEFAULTS.quotaUsd;
    return { quotaUsd, period, hardCap };
  } catch {
    return DEFAULTS;
  }
}

function periodStart(period: LimitsPeriod, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "month") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (period === "daily") return d.getTime();
  // week - start on Monday (ISO)
  const dow = d.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

function getPeriodSpend(period: LimitsPeriod): number {
  const cutoff = periodStart(period);
  const allRuns = store.getRuns({ limit: 10000 });
  return allRuns
    .filter((r) => r.ts >= cutoff)
    .reduce((sum, r) => sum + (r.cost ?? 0), 0);
}

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
  const limits = parseLimitsRaw(db.getUiSetting("claude-limits"));
  let warning: string | undefined;
  if (limits.hardCap !== "off" && limits.quotaUsd > 0) {
    const spent = getPeriodSpend(limits.period);
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

  return NextResponse.json(warning ? { runId, warning } : { runId });
}
