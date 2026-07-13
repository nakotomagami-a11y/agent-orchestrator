import { z } from "zod";
import { MAX_PROMPT_BYTES } from "@agent-office/domain/services/paths";

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
  unit: z.string().optional(),
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

const rgbTriple = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]);

const planetConfigSchema = z.object({
  type: z.enum(["gas-giant", "rocky", "dry", "terran", "ice", "islands", "lava", "black-hole", "galaxy", "star", "asteroid"]),
  seed: z.number().int(),
  paletteIdx: z.number().int().min(0),
  pixels: z.number().int().min(10).max(1000).optional(),
  rotation: z.number().optional(),
  dither: z.boolean().optional(),
  customPalette: z.array(z.array(rgbTriple)).optional(),
});

export const projectMetaPatchSchema = z.object({
  meta: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      planet: planetConfigSchema.optional(),
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
  // When true, the caller has acknowledged the soft-cap warning and wants to
  // proceed despite the instance count being above the soft limit.
  force: z.boolean().optional(),
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
  name: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/),
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
  resumeSessionId: z.string().optional(),
  contextProfile: z.enum(["tight", "balanced", "deep"]).optional(),
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

export const parallelPipelineStepSchema = z.object({
  kind: z.literal("parallel"),
  steps: z.array(pipelineStepSchema).min(2).max(8),
});

export const pipelineStepGroupSchema = z.union([pipelineStepSchema, parallelPipelineStepSchema]);

export const createPipelineRequestSchema = z.object({
  steps: z
    .array(pipelineStepGroupSchema)
    .min(2, "pipeline requires at least 2 step groups")
    .max(10, "pipeline allows at most 10 step groups"),
  projectId: z.string().optional(),
  cwd: z.string().optional(),
});

export const broadcastRequestSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1).max(MAX_PROMPT_BYTES),
  model: z.string().optional(),
  effort: z.string().optional(),
  cwd: z.string().optional(),
});

export const workflowCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  category: z.string().optional(),
});

export const workflowsBulkSchema = z.object({
  workflows: z.array(
    z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(5000),
      category: z.string().min(1),
    })
  ).min(1),
});

export const workflowsQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
});

/** Body payload for creating / updating a doc. Owner + slug live in the URL. */
export const docUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum([
    "architecture",
    "plan",
    "notes",
    "postmortem",
    "context",
    "reference",
  ]),
  body: z.string().max(256 * 1024),
});

export const bootstrapProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(60).optional(),
  description: z.string().max(500).optional(),
  frontend: z.enum(["none", "next", "vite", "react"]),
  backend: z.enum(["none", "node", "python"]),
  initGit: z.boolean().optional(),
});
