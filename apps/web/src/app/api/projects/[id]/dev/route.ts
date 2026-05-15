import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as net from "node:net";
import { NextResponse } from "next/server";
import { projects } from "@agent-office/shared/services";
import { validateIdParam, notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

async function findFreePort(start = 3001): Promise<number> {
  for (let p = start; p < start + 100; p++) {
    if (p === 5173) continue; // skip agent-office itself
    const free = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => {
        s.close(() => resolve(true));
      });
      s.listen(p, "127.0.0.1");
    });
    if (free) return p;
  }
  throw new Error("No free port found in range 3001–3100");
}

function detectPackageManager(cwd: string): string {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) return "bun";
  return "npm";
}

function detectDevInfo(cwd: string): { script: string; isNextJs: boolean } | null {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const script = pkg.scripts?.dev
      ? "dev"
      : pkg.scripts?.start
        ? "start"
        : pkg.scripts?.serve
          ? "serve"
          : null;
    if (!script) return null;
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const isNextJs = "next" in allDeps;
    return { script, isNextJs };
  } catch {
    return null;
  }
}

export async function POST(_req: Request, { params }: Params) {
  const { value: id, error } = validateIdParam((await params).id);
  if (error) return error;

  const project = projects.readProject(id);
  if (!project) return notFound();
  if (!project.meta.cwd) {
    return NextResponse.json(
      { error: "Project has no working directory configured" },
      { status: 400 },
    );
  }

  const cwd = project.meta.cwd;
  if (!existsSync(cwd)) {
    return NextResponse.json(
      { error: `Working directory not found: ${cwd}` },
      { status: 400 },
    );
  }

  const info = detectDevInfo(cwd);
  if (!info) {
    return NextResponse.json(
      { error: "No dev/start/serve script found in package.json" },
      { status: 400 },
    );
  }

  const pm = detectPackageManager(cwd);
  const port = await findFreePort(3001);

  const args = ["run", info.script];
  if (info.isNextJs) args.push("--", "-p", String(port));

  const child = spawn(pm, args, {
    cwd,
    env: { ...process.env, PORT: String(port) },
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return NextResponse.json({
    port,
    url: `http://localhost:${port}`,
    pid: child.pid,
    cmd: [pm, ...args].join(" "),
  });
}
