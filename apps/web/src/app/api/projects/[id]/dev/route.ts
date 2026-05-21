import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import * as net from "node:net";
import { NextResponse } from "next/server";
import { projects } from "@agent-office/shared/services";
import { validateIdParam, notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export type DetectedCommand = {
  key: string;
  name: string;
  argv: string[];
  portMode: "next" | "flutter" | "env" | "device";
  cwd?: string; // override project root (e.g. nested Flutter app)
};

async function findFreePort(start = 3001): Promise<number> {
  for (let p = start; p < start + 100; p++) {
    if (p === 5173) continue;
    const free = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => { s.close(() => resolve(true)); });
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

const DEV_SCRIPT_RE = /^(dev|start|serve|preview|watch|develop)([:.-].+)?$/;
const SKIP_SCRIPT_RE = /build|test|lint|type|check|emit|prepare|postinstall|prebuild/;

function scriptToName(key: string): string {
  if (key === "dev") return "Dev";
  if (key === "start") return "Start";
  if (key === "serve") return "Serve";
  if (key === "preview") return "Preview";
  return key.replace(/^(dev|start)[.:-]/, "").replace(/[-:]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function detectDevCommands(cwd: string, pm: string): DetectedCommand[] {
  // 1. .ao.json custom override — takes full priority
  const aoPath = join(cwd, ".ao.json");
  if (existsSync(aoPath)) {
    try {
      const cfg = JSON.parse(readFileSync(aoPath, "utf8")) as {
        devCommands?: Array<{ name: string; cmd: string }>;
      };
      if (Array.isArray(cfg.devCommands) && cfg.devCommands.length > 0) {
        return cfg.devCommands
          .filter((c) => typeof c.name === "string" && typeof c.cmd === "string")
          .map((c) => ({
            key: c.name.toLowerCase().replace(/\s+/g, "-"),
            name: c.name,
            argv: c.cmd.trim().split(/\s+/),
            portMode: "env" as const,
          }));
      }
    } catch { /* ignore */ }
  }

  const commands: DetectedCommand[] = [];

  // 2. Flutter — check root and common monorepo subfolders (apps/*, mobile/*, packages/*)
  const flutterCandidates: Array<{ dir: string; label: string }> = [
    { dir: cwd, label: "Flutter Web" },
  ];
  try {
    for (const parent of ["apps", "mobile", "packages"]) {
      const parentDir = join(cwd, parent);
      if (!existsSync(parentDir)) continue;
      for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        flutterCandidates.push({ dir: join(parentDir, entry.name), label: `Flutter — ${entry.name}` });
      }
    }
  } catch { /* ignore */ }

  for (const { dir, label } of flutterCandidates) {
    if (!existsSync(join(dir, "pubspec.yaml"))) continue;
    const key = dir === cwd ? "flutter" : `flutter-${dir.split("/").pop()}`;
    const isMobileApp = existsSync(join(dir, "android")) || existsSync(join(dir, "ios"));
    commands.push({
      key,
      name: label,
      argv: isMobileApp ? ["flutter", "run"] : ["flutter", "run", "-d", "web"],
      portMode: isMobileApp ? "device" : "flutter",
      cwd: dir,
    });
  }

  // 3. package.json scripts
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const isNextJs = "next" in allDeps;
      const scripts = pkg.scripts ?? {};

      // Sort so bare "dev"/"start" come before "dev:*"
      const keys = Object.keys(scripts).sort((a, b) => {
        const aBase = !a.includes(":") && !a.includes("-");
        const bBase = !b.includes(":") && !b.includes("-");
        return aBase === bBase ? a.localeCompare(b) : aBase ? -1 : 1;
      });

      for (const key of keys) {
        if (!DEV_SCRIPT_RE.test(key)) continue;
        if (SKIP_SCRIPT_RE.test(key)) continue;
        const isThisNext = isNextJs && (key === "dev" || key === "start");
        commands.push({
          key,
          name: scriptToName(key),
          argv: [pm, "run", key],
          portMode: isThisNext ? "next" : "env",
        });
      }
    } catch { /* ignore */ }
  }

  return commands;
}

function detectTerminal(): string | null {
  const names = ["gnome-terminal", "xterm", "x-terminal-emulator", "konsole", "xfce4-terminal", "alacritty", "kitty"];
  for (const name of names) {
    try {
      const p = execFileSync("which", [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (p) return p;
    } catch { /* not found */ }
  }
  return null;
}

function spawnInTerminal(title: string, cwd: string, argv: string[], port: number | null) {
  const portExport = port !== null ? `export PORT=${port}; ` : "";
  const cmdStr = argv.map((a) => /[\s"'\\$`!]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a).join(" ");
  const shell = `${portExport}cd ${JSON.stringify(cwd)} && ${cmdStr}; echo; read -rp $'\\nProcess ended (exit $?). Press Enter to close...'`;

  const termBin = detectTerminal();
  if (!termBin) {
    // Fallback: run directly (no visible terminal)
    const [bin, ...args] = argv;
    const child = spawn(bin!, args, { cwd, env: { ...process.env, ...(port !== null ? { PORT: String(port) } : {}) }, detached: true, stdio: "ignore" });
    child.unref();
    return child;
  }

  const termName = basename(termBin);
  let termArgs: string[];
  if (termName === "gnome-terminal") {
    termArgs = ["--wait", "--title", title, "--", "bash", "-c", shell];
  } else if (termName === "xterm") {
    termArgs = ["-title", title, "-e", "bash", "-c", shell];
  } else if (termName === "konsole") {
    termArgs = ["--hold", "--title", title, "-e", "bash", "-c", shell];
  } else if (termName === "alacritty") {
    termArgs = ["-T", title, "-e", "bash", "-c", shell];
  } else if (termName === "kitty") {
    termArgs = ["--title", title, "bash", "-c", shell];
  } else {
    termArgs = ["-e", "bash", "-c", shell];
  }

  const child = spawn(termBin, termArgs, { detached: true, stdio: "ignore" });
  child.unref();
  return child;
}

export async function GET(_req: Request, { params }: Params) {
  const { value: id, error } = validateIdParam((await params).id);
  if (error) return error;

  const project = projects.readProject(id);
  if (!project) return notFound();

  const cwd = project.meta.cwd;
  if (!cwd || !existsSync(cwd)) {
    return NextResponse.json({ hasNodeModules: false, pm: "npm", commands: [] });
  }

  const pm = detectPackageManager(cwd);
  const hasNodeModules = existsSync(join(cwd, "node_modules"));
  const commands = detectDevCommands(cwd, pm);
  return NextResponse.json({ hasNodeModules, pm, commands });
}

export async function POST(req: Request, { params }: Params) {
  const { value: id, error } = validateIdParam((await params).id);
  if (error) return error;

  const project = projects.readProject(id);
  if (!project) return notFound();

  const cwd = project.meta.cwd;
  if (!cwd || !existsSync(cwd)) {
    return NextResponse.json({ error: "Working directory not found" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { commandKey?: string };
  const pm = detectPackageManager(cwd);
  const commands = detectDevCommands(cwd, pm);

  const command = (body.commandKey ? commands.find((c) => c.key === body.commandKey) : null) ?? commands[0];
  if (!command) {
    return NextResponse.json({ error: "No dev commands detected for this project" }, { status: 400 });
  }

  const needsPort = command.portMode !== "device";
  const port = needsPort ? await findFreePort(3001) : 0;
  const argv = [...command.argv];
  if (command.portMode === "next") argv.push("--", "-p", String(port));
  else if (command.portMode === "flutter") argv.push("--web-port", String(port));

  const cmdCwd = command.cwd ?? cwd;
  const child = spawnInTerminal(command.name, cmdCwd, argv, needsPort ? port : null);

  return NextResponse.json({ key: command.key, port: needsPort ? port : null, url: needsPort ? `http://localhost:${port}` : null, pid: child.pid });
}
