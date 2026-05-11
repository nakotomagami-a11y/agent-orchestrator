import { z } from "zod";
import { MAX_PROMPT_BYTES } from "@agent-office/shared/services/paths";

export const agentBodySchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1),
  desc: z.string().default(""),
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  pm: z.string().default("ask"),
  model: z.string().default("sonnet"),
  effort: z.string().default("medium"),
  body: z.string().default(""),
  room: z.string().optional(),
});

export const agentBodyListSchema = z.array(agentBodySchema);

export const settingsPatchSchema = z.object({
  projectsRoot: z.string().min(1),
  excluded: z.array(z.string()).default([]),
});

export const settingsScanQuerySchema = z.object({
  root: z.string().default(""),
  excluded: z.string().default(""),
  includeExcluded: z.string().optional(),
});

export const projectMetaPatchSchema = z.object({
  meta: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      roster: z
        .array(
          z.object({
            instanceId: z.string(),
            agentId: z.string(),
            label: z.string().optional(),
            model: z.string().optional(),
            effort: z.string().optional(),
            permissionMode: z.string().optional(),
            room: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  memory: z.string().optional(),
});

export const createProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  roster: z.array(z.unknown()).optional(),
});

export const rosterAddSchema = z.object({
  agentId: z.string().min(1),
  init: z
    .object({
      label: z.string().optional(),
      model: z.string().optional(),
      effort: z.string().optional(),
      permissionMode: z.string().optional(),
      room: z.string().optional(),
    })
    .optional(),
});

export const rosterPatchSchema = z.object({
  label: z.string().optional(),
  model: z.string().optional(),
  effort: z.string().optional(),
  permissionMode: z.string().optional(),
  room: z.string().optional(),
});

export const skillInstallSchema = z.object({
  source: z.string().min(1),
  ref: z.string().min(1),
  path: z.string().min(1),
  name: z.string().min(1),
});

export const promptPostSchema = z.object({
  prompt: z.string().min(1).max(MAX_PROMPT_BYTES),
});

export const summonRequestSchema = z.object({
  agentId: z.string().min(1),
  prompt: z.string().min(1).max(MAX_PROMPT_BYTES),
  model: z.string().optional(),
  effort: z.string().optional(),
  maxBudgetUsd: z.number().positive().optional(),
  cwd: z.string().optional(),
  projectId: z.string().optional(),
  instanceId: z.string().optional(),
});

export const runsQuerySchema = z.object({
  agent: z
    .string()
    .regex(/^[A-Za-z0-9._-]+$/)
    .optional(),
  project: z
    .string()
    .regex(/^[A-Za-z0-9._-]+$/)
    .optional(),
  instance: z
    .string()
    .regex(/^[A-Za-z0-9._-]+$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const skillsRegistryQuerySchema = z.object({
  refresh: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export const healthQuerySchema = z.object({
  force: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export const pipelineStepSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  instanceId: z.string().optional(),
  promptTemplate: z.string().min(1, "promptTemplate is required"),
  model: z.string().optional(),
  effort: z.string().optional(),
});

export const createPipelineRequestSchema = z.object({
  steps: z
    .array(pipelineStepSchema)
    .min(2, "pipeline requires at least 2 steps")
    .max(10, "pipeline allows at most 10 steps"),
  projectId: z.string().optional(),
  cwd: z.string().optional(),
});
