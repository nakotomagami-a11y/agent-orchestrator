// Multi-agent pipeline orchestration.
//
// `createPipeline` chains sequential runs where each step's prompt template
// can reference `{{output}}` to receive the previous step's finalised output.
// The function returns immediately with all steps in "pending" state and
// continues orchestration in the background.

import { randomUUID } from "node:crypto";
import type { CreatePipelineRequest, PipelineRun, PipelineRunStep } from "../types/index";
import * as agents from "./agents";
import * as projects from "./projects";
import * as summon from "./summon";
import * as runs from "./runs";
import * as store from "./store";
import { log } from "./log";

declare global {
  // eslint-disable-next-line no-var
  var __agentOfficePipelines: Map<string, PipelineRun> | undefined;
}

const pipelines: Map<string, PipelineRun> =
  globalThis.__agentOfficePipelines ??
  (globalThis.__agentOfficePipelines = new Map());

const POLL_INTERVAL_MS = 500;
const STEP_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export function getPipeline(id: string): PipelineRun | undefined {
  return pipelines.get(id);
}

export function listPipelines(): PipelineRun[] {
  return Array.from(pipelines.values());
}

/**
 * Poll until the run leaves "running" status, or until the step timeout
 * elapses. Resolves with the final status and output. Rejects with a
 * descriptive Error on timeout.
 */
async function waitForRun(runId: string): Promise<{ output: string; exitCode: number }> {
  const deadline = Date.now() + STEP_TIMEOUT_MS;

  while (true) {
    const live = runs.getLiveRun(runId);
    if (live) {
      if (live.status !== "running") {
        return { output: live.output, exitCode: live.exitCode ?? (live.status === "done" ? 0 : 1) };
      }
    } else {
      // Run has left the live registry — check the persisted store.
      const persisted = store.getRun(runId);
      if (persisted) {
        return {
          output: persisted.output,
          exitCode: persisted.exitCode ?? (persisted.status === "done" ? 0 : 1),
        };
      }
      // Not in either store yet — may be a brief gap between finalise and persist.
    }

    if (Date.now() >= deadline) {
      throw new Error(`step timed out after ${STEP_TIMEOUT_MS / 1000}s (runId=${runId})`);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function runOrchestration(pipeline: PipelineRun, req: CreatePipelineRequest): Promise<void> {
  const project = req.projectId ? projects.readProject(req.projectId) : null;
  let previousOutput = "";

  for (let i = 0; i < req.steps.length; i++) {
    const step = req.steps[i]!;
    const pipelineStep = pipeline.steps[i]!;

    // Resolve the prompt for this step.
    const prompt = step.promptTemplate.replace(/\{\{output\}\}/g, previousOutput);

    // Resolve agent + instance.
    const agentResult = agents.readAgent(step.agentId);
    if (!agentResult) {
      const errMsg = `agent '${step.agentId}' not found at step ${i}`;
      log.warn("pipeline.agent_not_found", { pipelineId: pipeline.id, stepIndex: i, agentId: step.agentId });
      pipelineStep.status = "error";
      // Mark all remaining steps as error too.
      for (let j = i + 1; j < pipeline.steps.length; j++) {
        pipeline.steps[j]!.status = "error";
      }
      pipeline.status = "error";
      return;
    }

    const instance = projects.findInstance(project, step.instanceId);
    const appendedSystemPrompt = agents.buildAppendedPrompt(step.agentId, project);

    const summonReq = {
      agentId: step.agentId,
      prompt,
      model: step.model,
      effort: step.effort,
      cwd: req.cwd,
      projectId: req.projectId,
      instanceId: step.instanceId,
    };

    const built = summon.buildClaudeArgs({
      request: summonReq,
      agent: agentResult.info,
      instance,
      appendedSystemPrompt,
    });

    const instanceLabel = instance?.label ?? (instance ? agentResult.info.name : undefined);

    pipelineStep.status = "running";
    log.info("pipeline.step.start", { pipelineId: pipeline.id, stepIndex: i, agentId: step.agentId });

    let result: { output: string; exitCode: number };
    try {
      const { runId } = runs.startRun({
        agentId: step.agentId,
        agentName: instanceLabel ?? agentResult.info.name,
        prompt,
        model: built.model,
        effort: built.effort,
        cwd: req.cwd,
        projectId: req.projectId,
        instanceId: instance?.instanceId,
        instanceLabel,
        args: built.args,
      });
      pipelineStep.runId = runId;

      result = await waitForRun(runId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("pipeline.step.error", { pipelineId: pipeline.id, stepIndex: i, error: message });
      pipelineStep.status = "error";
      pipelineStep.exitCode = 1;
      for (let j = i + 1; j < pipeline.steps.length; j++) {
        pipeline.steps[j]!.status = "error";
      }
      pipeline.status = "error";
      return;
    }

    pipelineStep.output = result.output;
    pipelineStep.exitCode = result.exitCode;

    if (result.exitCode !== 0) {
      log.warn("pipeline.step.nonzero_exit", { pipelineId: pipeline.id, stepIndex: i, exitCode: result.exitCode });
      pipelineStep.status = "error";
      for (let j = i + 1; j < pipeline.steps.length; j++) {
        pipeline.steps[j]!.status = "error";
      }
      pipeline.status = "error";
      return;
    }

    pipelineStep.status = "done";
    previousOutput = result.output;
    log.info("pipeline.step.done", { pipelineId: pipeline.id, stepIndex: i });
  }

  pipeline.status = "done";
  log.info("pipeline.done", { pipelineId: pipeline.id });
}

/**
 * Create a pipeline and begin asynchronous orchestration immediately.
 * Returns the initial `PipelineRun` with all steps in "pending" state —
 * do not await the orchestration in the caller.
 */
export function createPipeline(req: CreatePipelineRequest): PipelineRun {
  const id = randomUUID();

  const steps: PipelineRunStep[] = req.steps.map((step, i) => ({
    stepIndex: i,
    agentId: step.agentId,
    runId: "", // filled in as each step starts
    status: "pending",
  }));

  const pipeline: PipelineRun = {
    id,
    projectId: req.projectId,
    steps,
    status: "running",
    createdAt: Date.now(),
  };

  pipelines.set(id, pipeline);
  log.info("pipeline.created", { pipelineId: id, stepCount: req.steps.length });

  // Fire-and-forget — catch all errors so nothing bubbles to the caller.
  void runOrchestration(pipeline, req).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("pipeline.orchestration_uncaught", { pipelineId: id, error: message });
    pipeline.status = "error";
    for (const step of pipeline.steps) {
      if (step.status === "pending" || step.status === "running") {
        step.status = "error";
      }
    }
  });

  return pipeline;
}
