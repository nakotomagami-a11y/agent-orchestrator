import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { agents, projects, runs, summon } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { broadcastRequestSchema } from "@/lib/validation-schemas";
import { badRequest } from "@/lib/api-helpers";

export async function POST(request: Request) {
  const raw: unknown = await request.json();
  const { data: req, error } = validateBody(broadcastRequestSchema, raw);
  if (error) return error;

  const project = projects.readProject(req.projectId);
  if (!project) return badRequest(`unknown project: ${req.projectId}`);

  const { roster } = project.meta;
  if (roster.length === 0) {
    return NextResponse.json({ error: "roster_empty", detail: "Project has no agents on roster" }, { status: 400 });
  }

  const broadcastId = randomUUID();
  const runIds: string[] = [];

  for (const inst of roster) {
    const agentResult = agents.readAgent(inst.agentId);
    if (!agentResult) continue;

    const instance = projects.findInstance(project, inst.instanceId);
    const appendedSystemPrompt = agents.buildAppendedPrompt(inst.agentId, project, inst.instanceId);

    const built = summon.buildClaudeArgs({
      request: {
        agentId: inst.agentId,
        prompt: req.prompt,
        model: req.model ?? inst.model,
        effort: req.effort ?? inst.effort,
        cwd: req.cwd,
        projectId: req.projectId,
        instanceId: inst.instanceId,
      },
      agent: agentResult.info,
      instance,
      appendedSystemPrompt,
    });

    const instanceLabel = inst.label ?? agentResult.info.name;

    const { runId } = runs.startRun({
      agentId: inst.agentId,
      agentName: instanceLabel,
      prompt: req.prompt,
      model: built.model,
      effort: built.effort,
      cwd: req.cwd,
      projectId: req.projectId,
      instanceId: inst.instanceId,
      instanceLabel,
      args: built.args,
    });

    runIds.push(runId);
  }

  return NextResponse.json({ broadcastId, runIds }, { status: 202 });
}
