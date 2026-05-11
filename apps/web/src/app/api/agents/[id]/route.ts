import { NextResponse } from "next/server";
import { agents } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { agentBodySchema } from "@/lib/validation-schemas";
import { notFound, tryService } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const agent = agents.readAgent(id);
  if (!agent) return notFound();
  return NextResponse.json(agent.info);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const raw: unknown = await request.json();
  const { data: body, error } = validateBody(agentBodySchema, raw);
  if (error) return error;
  body.id = id;
  return tryService(() => ({ id: agents.writeAgent(body) }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const ok = agents.deleteAgent(id);
  return ok ? NextResponse.json({ deleted: id }) : notFound();
}
