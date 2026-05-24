import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { projects } from "@agent-office/shared/services";
import { validateIdParam, notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const { value, error } = validateIdParam(id);
  if (error) return error;

  const project = projects.readProject(value);
  if (!project) return notFound("Project");

  const cwd = project.meta.cwd;
  if (!cwd) return NextResponse.json({ error: "No cwd" }, { status: 400 });

  spawn("xdg-open", [cwd], { detached: true, stdio: "ignore" }).unref();

  return NextResponse.json({ ok: true });
}
