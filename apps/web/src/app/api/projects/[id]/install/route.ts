import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { projects } from "@agent-office/shared/services";
import { validateIdParam, notFound } from "@/lib/api-helpers";

const execFileAsync = promisify(execFile);

type Params = { params: Promise<{ id: string }> };

function detectPackageManager(cwd: string): string {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) return "bun";
  return "npm";
}

export async function POST(_req: Request, { params }: Params) {
  const { value: id, error } = validateIdParam((await params).id);
  if (error) return error;

  const project = projects.readProject(id);
  if (!project) return notFound();

  const cwd = project.meta.cwd;
  if (!cwd || !existsSync(cwd)) {
    return NextResponse.json({ error: "Working directory not found" }, { status: 400 });
  }

  const pm = detectPackageManager(cwd);

  try {
    await execFileAsync(pm, ["install"], { cwd, timeout: 120_000 });
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    return NextResponse.json(
      { error: (e.stderr ?? e.message ?? "Install failed").slice(-2000) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, pm });
}
