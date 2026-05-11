import { NextResponse } from "next/server";
import { projects } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { projectMetaPatchSchema } from "@/lib/validation-schemas";
import { notFound, tryService } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const p = projects.readProject(id);
  if (!p) return notFound();
  return NextResponse.json(p);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const raw: unknown = await request.json();
  const { data, error } = validateBody(projectMetaPatchSchema, raw);
  if (error) return error;
  return tryService(() => projects.updateProject(id, data));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return projects.deleteProject(id) ? NextResponse.json({ deleted: id }) : notFound();
}
