import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, isAbsolute } from "node:path";
import { NextResponse } from "next/server";
import { projects } from "@agent-office/shared/services";
import { registerProcess, registerStdin, deleteStdin, appendLine, setExited } from "@/lib/server-process-store";
import { badRequest, notFound, serverError } from "@/lib/api-helpers";

// Per-project flutter run PID tracking
const flutterPids = new Map<string, number>();

function findFlutterBin(): string {
  try {
    return execFileSync("which", ["flutter"], { encoding: "utf8" }).trim() || "flutter";
  } catch {
    return existsSync("/snap/bin/flutter") ? "/snap/bin/flutter" : "flutter";
  }
}

function findPubspecDir(cwd: string): string | null {
  if (existsSync(join(cwd, "pubspec.yaml"))) return cwd;
  // Common single-level sub-dirs
  for (const sub of ["app", "mobile", "flutter", "client", "frontend"]) {
    const dir = join(cwd, sub);
    if (existsSync(join(dir, "pubspec.yaml"))) return dir;
  }
  // Monorepo: check apps/* and packages/*
  for (const parent of ["apps", "packages"]) {
    const parentDir = join(cwd, parent);
    if (!existsSync(parentDir)) continue;
    try {
      for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const dir = join(parentDir, entry.name);
        if (existsSync(join(dir, "pubspec.yaml"))) return dir;
      }
    } catch { /* ignore */ }
  }
  return null;
}

export async function POST(req: Request) {
  let body: { projectId?: string; deviceId?: string; customPath?: string } = {};
  try { body = await req.json() as typeof body; } catch { /* no body */ }

  const { projectId, deviceId, customPath } = body;

  let flutterCwd: string | null = null;
  const trackingKey = projectId ?? `custom:${customPath ?? ""}`;

  if (customPath) {
    const expanded = customPath.replace(/^~(?=\/|$)/, homedir());
    if (!isAbsolute(expanded) || !existsSync(expanded)) return badRequest("custom path not found");
    if (!existsSync(join(expanded, "pubspec.yaml"))) return badRequest("no pubspec.yaml in custom path");
    flutterCwd = expanded;
  } else {
    if (!projectId) return badRequest("projectId or customPath required");
    const project = projects.readProject(projectId);
    if (!project) return notFound("project not found");
    const cwd = project.meta.cwd;
    if (!cwd || !isAbsolute(cwd) || !existsSync(cwd)) return badRequest("working directory not found");
    flutterCwd = findPubspecDir(cwd);
    if (!flutterCwd) return badRequest(`no pubspec.yaml found in ${cwd} — select a Flutter project in the office or use a custom path`);
  }

  // Kill existing run for this project
  const existingPid = flutterPids.get(trackingKey);
  if (existingPid) {
    try { process.kill(existingPid, "SIGTERM"); } catch { /* already gone */ }
    flutterPids.delete(trackingKey);
  }

  const flutterBin = findFlutterBin();
  const args = ["run", "--no-pub"];
  if (deviceId) args.push("-d", deviceId);

  const spawnEnv = { ...process.env, PATH: `/snap/bin:${process.env.PATH ?? ""}` };

  const child = spawn(flutterBin, args, {
    cwd: flutterCwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: spawnEnv,
  });

  if (!child.pid) return serverError("failed to start flutter run");

  const pid = child.pid;
  flutterPids.set(trackingKey, pid);
  registerProcess(pid);
  if (child.stdin) registerStdin(pid, child.stdin);

  child.stdout?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (line.trim()) appendLine(pid, line);
    }
  });
  child.stderr?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (line.trim()) appendLine(pid, `[err] ${line}`);
    }
  });
  child.on("exit", (code, signal) => {
    setExited(pid, code, signal);
    deleteStdin(pid);
    if (flutterPids.get(trackingKey) === pid) flutterPids.delete(trackingKey);
  });

  return NextResponse.json({ pid, flutterCwd });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const customPath = searchParams.get("customPath");
  const key = customPath ? `custom:${customPath}` : projectId;
  if (!key) return badRequest("projectId or customPath required");

  const pid = flutterPids.get(key);
  if (!pid) return NextResponse.json({ ok: true, wasRunning: false });

  try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
  flutterPids.delete(key);

  return NextResponse.json({ ok: true, wasRunning: true, pid });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const customPath = searchParams.get("customPath");
  const key = customPath ? `custom:${customPath}` : projectId;
  if (!key) return badRequest("projectId or customPath required");

  const pid = flutterPids.get(key) ?? null;
  let alive = false;
  if (pid) {
    try { process.kill(pid, 0); alive = true; } catch { /* not alive */ }
  }

  return NextResponse.json({ pid, alive });
}
