import { NextResponse } from "next/server";
import { agents } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { agentBodySchema } from "@/lib/validation-schemas";
import { notFound, tryService, validateIdParam } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { value: id, error } = validateIdParam((await params).id);
  if (error) return error;
  const agent = agents.readAgent(id);
  if (!agent) return notFound();
  return NextResponse.json(agent.info);
}

export async function PUT(request: Request, { params }: Params) {
  const { value: id, error: paramError } = validateIdParam((await params).id);
  if (paramError) return paramError;
  const raw: unknown = await request.json();
  const { data: body, error } = validateBody(agentBodySchema, raw);
  if (error) return error;
  return tryService(() => ({ id: agents.writeAgent({ ...body, id }) }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { value: id, error } = validateIdParam((await params).id);
  if (error) return error;
  const ok = agents.deleteAgent(id);
  return ok ? NextResponse.json({ deleted: id }) : notFound();
}
