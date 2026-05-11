import { spawn } from "bun";
import {
  existsSync, statSync, rmSync, mkdirSync, readdirSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const UPLOADS_DIR = join(homedir(), ".claude", "agents", "_uploads");
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB / file

function agentUploadsDir(agentId: string): string {
  return join(UPLOADS_DIR, agentId);
}

const PROJECT_UPLOADS_ROOT = join(homedir(), ".claude", "projects");

function projectUploadsDir(projectId: string): string {
  return join(PROJECT_UPLOADS_ROOT, projectId, "_uploads");
}

function listDirUploads(dir: string): Array<{ filename: string; path: string; size: number }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map(f => {
    const p = join(dir, f);
    return { filename: f, path: p, size: statSync(p).size };
  }).sort((a, b) => a.filename.localeCompare(b.filename));
}

function listAgentUploads(agentId: string): Array<{ filename: string; path: string; size: number }> {
  return listDirUploads(agentUploadsDir(agentId));
}

function safeFilename(name: string): string {
  // Strip path separators + control chars; preserve dots and dashes
  return name.replace(/[/\\\0]+/g, "_").replace(/^\.+/, "").slice(0, 200) || "file";
}
import {
  AGENTS_DIR, GLOBAL_MEMORY_PATH, listAgents, readAgent, writeAgent,
  memoryPathFor, readMemory, writeMemory, buildAppendedPrompt,
} from "./agents";
import { AGENT_TEMPLATES } from "../shared/agent_templates";
import {
  listProjectSummaries, readProject, createProject, updateProject, deleteProject,
  resolveSummonCwd, addInstance, patchInstance, removeInstance, findInstance,
} from "./projects";
import { readSettings, writeSettings, scanProjects } from "./settings";
import type { ProjectMeta, AppSettings, AgentInstance } from "../shared/types";
import { startRun, attachWS, detachWS, abortRun, killAllRuns, getLiveRun } from "./runs";
import { getRuns, getRecentPrompts, pushRecentPrompt, getAllRecentPrompts } from "./store";
import {
  fetchRegistry, installSkill, uninstallSkill, listInstalled, readInstalledSkill,
  checkForUpdates, updateSkill, registrySources,
} from "./skills";
import { log } from "./log";
import type {
  AgentBody, HealthInfo, WSClientMessage,
} from "../shared/types";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = "127.0.0.1";
const STATIC_DIR = join(import.meta.dir, "..", "client", "dist");

let claudeStatus: HealthInfo = { available: false, version: null };

async function checkClaude() {
  try {
    const proc = spawn(["claude", "--version"], { stdout: "pipe", stderr: "pipe" });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code === 0) claudeStatus = { available: true, version: out.trim() };
    else claudeStatus = { available: false, version: null, error: `exit ${code}` };
  } catch (e) {
    claudeStatus = { available: false, version: null, error: String(e) };
  }
}

const cors = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function jsonResponse(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { ...cors, ...(init?.headers ?? {}) } });
}

function textResponse(text: string, init?: ResponseInit) {
  return new Response(text, {
    ...init,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...cors, ...(init?.headers ?? {}) },
  });
}

interface WSData { wsId?: string; }

await checkClaude();

const server = Bun.serve<WSData, string>({
  port: PORT,
  hostname: HOST,
  async fetch(req, server) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    // ─── API ───
    if (url.pathname === "/api/health") return jsonResponse(claudeStatus);

    if (url.pathname === "/api/agents" && req.method === "GET") {
      return jsonResponse(listAgents());
    }

    if (url.pathname === "/api/agents" && req.method === "POST") {
      try {
        const body = (await req.json()) as AgentBody;
        const id = writeAgent(body);
        return jsonResponse({ id });
      } catch (e) {
        return textResponse(String(e), { status: 400 });
      }
    }

    if (url.pathname === "/api/agents/bulk" && req.method === "POST") {
      try {
        const items = (await req.json()) as AgentBody[];
        const written: string[] = [];
        const errors: Array<{ id: string; error: string }> = [];
        for (const item of items) {
          try { written.push(writeAgent(item)); }
          catch (e) { errors.push({ id: item.id, error: String(e) }); }
        }
        return jsonResponse({ written, errors });
      } catch (e) {
        return textResponse(String(e), { status: 400 });
      }
    }

    if (url.pathname === "/api/templates" && req.method === "GET") {
      return jsonResponse(AGENT_TEMPLATES);
    }

    // ─── Settings ──────────────────────────────────────────────────────
    if (url.pathname === "/api/settings" && req.method === "GET") {
      return jsonResponse(readSettings());
    }
    if (url.pathname === "/api/settings" && req.method === "PUT") {
      try {
        const body = (await req.json()) as Partial<AppSettings>;
        if (typeof body.projectsRoot !== "string" || !body.projectsRoot.trim()) {
          return textResponse("projectsRoot required", { status: 400 });
        }
        const settings: AppSettings = {
          projectsRoot: body.projectsRoot.trim(),
          excluded: Array.isArray(body.excluded) ? body.excluded.filter(x => typeof x === "string") : [],
          firstRunComplete: true,
        };
        writeSettings(settings);
        return jsonResponse(settings);
      } catch (e) {
        return textResponse(String(e), { status: 400 });
      }
    }
    if (url.pathname === "/api/settings/scan" && req.method === "GET") {
      const root = url.searchParams.get("root") ?? "";
      const exc = (url.searchParams.get("excluded") ?? "").split(",").filter(Boolean);
      const includeExcl = url.searchParams.get("includeExcluded") === "1";
      return jsonResponse(scanProjects(root, exc, includeExcl));
    }

    // ─── Projects ─────────────────────────────────────────────────────────
    if (url.pathname === "/api/projects" && req.method === "GET") {
      return jsonResponse(listProjectSummaries());
    }
    if (url.pathname === "/api/projects" && req.method === "POST") {
      try {
        const body = (await req.json()) as Partial<ProjectMeta> & { name: string };
        const project = createProject(body);
        return jsonResponse(project);
      } catch (e) {
        return textResponse(String(e), { status: 400 });
      }
    }
    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && req.method === "GET") {
      const id = decodeURIComponent(projectMatch[1]);
      const p = readProject(id);
      if (!p) return textResponse("not found", { status: 404 });
      return jsonResponse(p);
    }
    if (projectMatch && req.method === "PUT") {
      try {
        const id = decodeURIComponent(projectMatch[1]);
        const body = (await req.json()) as { meta?: Partial<ProjectMeta>; memory?: string };
        const updated = updateProject(id, body);
        return jsonResponse(updated);
      } catch (e) {
        const msg = String(e);
        const status = /not found/i.test(msg) ? 404 : 400;
        return textResponse(msg, { status });
      }
    }
    if (projectMatch && req.method === "DELETE") {
      const id = decodeURIComponent(projectMatch[1]);
      const ok = deleteProject(id);
      return ok ? jsonResponse({ deleted: id }) : textResponse("not found", { status: 404 });
    }

    // ─── Roster endpoints ────────────────────────────────────────────────
    const rosterAddMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/roster$/);
    if (rosterAddMatch && req.method === "POST") {
      try {
        const id = decodeURIComponent(rosterAddMatch[1]);
        const body = (await req.json()) as { agentId: string; init?: Partial<AgentInstance> };
        if (!body.agentId) return textResponse("agentId required", { status: 400 });
        const { project, instance } = addInstance(id, body.agentId, body.init);
        return jsonResponse({ project, instance });
      } catch (e) {
        const msg = String(e);
        const status = /not found/i.test(msg) ? 404 : 400;
        return textResponse(msg, { status });
      }
    }

    const rosterItemMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/roster\/([^/]+)$/);
    if (rosterItemMatch && req.method === "PATCH") {
      try {
        const projectId = decodeURIComponent(rosterItemMatch[1]);
        const instanceId = decodeURIComponent(rosterItemMatch[2]);
        const patch = (await req.json()) as Partial<AgentInstance>;
        const updated = patchInstance(projectId, instanceId, patch);
        return jsonResponse(updated);
      } catch (e) {
        const msg = String(e);
        const status = /not found/i.test(msg) ? 404 : 400;
        return textResponse(msg, { status });
      }
    }
    if (rosterItemMatch && req.method === "DELETE") {
      try {
        const projectId = decodeURIComponent(rosterItemMatch[1]);
        const instanceId = decodeURIComponent(rosterItemMatch[2]);
        const updated = removeInstance(projectId, instanceId);
        return jsonResponse(updated);
      } catch (e) {
        const msg = String(e);
        const status = /not found/i.test(msg) ? 404 : 400;
        return textResponse(msg, { status });
      }
    }

    // Text-only project memory endpoint — mirrors /api/memory/global shape so
    // the existing MemoryEditor component can plug in unmodified.
    const projectMemoryMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/memory$/);
    if (projectMemoryMatch) {
      const id = decodeURIComponent(projectMemoryMatch[1]);
      if (req.method === "GET") {
        const p = readProject(id);
        if (!p) return textResponse("not found", { status: 404 });
        return textResponse(p.memory);
      }
      if (req.method === "PUT") {
        try {
          const text = await req.text();
          updateProject(id, { memory: text });
          return new Response("ok", { headers: cors });
        } catch (e) {
          const msg = String(e);
          const status = /not found/i.test(msg) ? 404 : 400;
          return textResponse(msg, { status });
        }
      }
    }

    const editMatch = url.pathname.match(/^\/api\/agents\/([^/]+)$/);
    if (editMatch && req.method === "PUT") {
      try {
        const id = decodeURIComponent(editMatch[1]);
        const body = (await req.json()) as AgentBody;
        body.id = id;
        writeAgent(body);
        return jsonResponse({ id });
      } catch (e) {
        return textResponse(String(e), { status: 400 });
      }
    }

    const uploadsListMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/uploads$/);
    if (uploadsListMatch && req.method === "GET") {
      const id = decodeURIComponent(uploadsListMatch[1]);
      return jsonResponse(listAgentUploads(id));
    }
    if (uploadsListMatch && req.method === "POST") {
      const id = decodeURIComponent(uploadsListMatch[1]);
      try {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return textResponse("missing file", { status: 400 });
        if (file.size > MAX_UPLOAD_BYTES) {
          return textResponse(`file too large (${file.size} > ${MAX_UPLOAD_BYTES})`, { status: 413 });
        }
        const dir = agentUploadsDir(id);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const filename = safeFilename(file.name);
        const path = join(dir, filename);
        const buf = await file.arrayBuffer();
        writeFileSync(path, Buffer.from(buf));
        log.info("upload", { agent: id, filename, size: file.size });
        return jsonResponse({ filename, path, size: file.size });
      } catch (e) {
        return textResponse(String(e), { status: 500 });
      }
    }

    const uploadRmMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/uploads\/([^/]+)$/);
    if (uploadRmMatch && req.method === "DELETE") {
      const id = decodeURIComponent(uploadRmMatch[1]);
      const filename = safeFilename(decodeURIComponent(uploadRmMatch[2]));
      const path = join(agentUploadsDir(id), filename);
      if (!existsSync(path)) return textResponse("not found", { status: 404 });
      rmSync(path);
      return jsonResponse({ deleted: filename });
    }

    // ─── Project uploads (parallel surface to agent uploads) ─────────────
    const projUploadsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/uploads$/);
    if (projUploadsMatch && req.method === "GET") {
      const id = decodeURIComponent(projUploadsMatch[1]);
      return jsonResponse(listDirUploads(projectUploadsDir(id)));
    }
    if (projUploadsMatch && req.method === "POST") {
      const id = decodeURIComponent(projUploadsMatch[1]);
      try {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return textResponse("missing file", { status: 400 });
        if (file.size > MAX_UPLOAD_BYTES) {
          return textResponse(`file too large (${file.size} > ${MAX_UPLOAD_BYTES})`, { status: 413 });
        }
        const dir = projectUploadsDir(id);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const filename = safeFilename(file.name);
        const path = join(dir, filename);
        const buf = await file.arrayBuffer();
        writeFileSync(path, Buffer.from(buf));
        log.info("upload.project", { project: id, filename, size: file.size });
        return jsonResponse({ filename, path, size: file.size });
      } catch (e) {
        return textResponse(String(e), { status: 500 });
      }
    }
    const projUploadRmMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/uploads\/([^/]+)$/);
    if (projUploadRmMatch && req.method === "DELETE") {
      const id = decodeURIComponent(projUploadRmMatch[1]);
      const filename = safeFilename(decodeURIComponent(projUploadRmMatch[2]));
      const path = join(projectUploadsDir(id), filename);
      if (!existsSync(path)) return textResponse("not found", { status: 404 });
      rmSync(path);
      return jsonResponse({ deleted: filename });
    }

    if (editMatch && req.method === "DELETE") {
      const id = decodeURIComponent(editMatch[1]);
      const mdPath = join(AGENTS_DIR, `${id}.md`);
      const memPath = memoryPathFor(id);
      if (!existsSync(mdPath)) return textResponse("not found", { status: 404 });
      try {
        rmSync(mdPath);
        if (existsSync(memPath)) rmSync(memPath);
        return jsonResponse({ deleted: id });
      } catch (e) {
        return textResponse(String(e), { status: 500 });
      }
    }

    const bodyMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/body$/);
    if (bodyMatch) {
      const agent = readAgent(decodeURIComponent(bodyMatch[1]));
      if (!agent) return textResponse("not found", { status: 404 });
      return textResponse(agent.body);
    }

    if (url.pathname === "/api/memory/global") {
      if (req.method === "GET") return textResponse(readMemory(GLOBAL_MEMORY_PATH));
      if (req.method === "PUT") {
        try {
          writeMemory(GLOBAL_MEMORY_PATH, await req.text());
          return textResponse("ok");
        } catch (e) { return textResponse(String(e), { status: 500 }); }
      }
    }

    const memMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/memory$/);
    if (memMatch) {
      const agent = decodeURIComponent(memMatch[1]);
      if (req.method === "GET") return textResponse(readMemory(memoryPathFor(agent)));
      if (req.method === "PUT") {
        try {
          writeMemory(memoryPathFor(agent), await req.text());
          return textResponse("ok");
        } catch (e) { return textResponse(String(e), { status: 500 }); }
      }
    }

    const promptMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/prompts$/);
    if (promptMatch) {
      const agent = decodeURIComponent(promptMatch[1]);
      if (req.method === "GET") return jsonResponse(getRecentPrompts(agent));
      if (req.method === "POST") {
        try {
          const { prompt } = (await req.json()) as { prompt: string };
          pushRecentPrompt(agent, prompt);
          return jsonResponse({ ok: true });
        } catch (e) { return textResponse(String(e), { status: 400 }); }
      }
    }

    if (url.pathname === "/api/prompts") return jsonResponse(getAllRecentPrompts());

    // ─── Skills (registry + installed) ───
    if (url.pathname === "/api/skills/registry") {
      const force = url.searchParams.get("refresh") === "1";
      try {
        const entries = await fetchRegistry(force);
        return jsonResponse(entries);
      } catch (e) {
        return textResponse(String(e), { status: 502 });
      }
    }

    if (url.pathname === "/api/skills/installed") {
      return jsonResponse(listInstalled());
    }

    if (url.pathname === "/api/skills/sources") {
      return jsonResponse(registrySources());
    }

    if (url.pathname === "/api/skills/updates") {
      try {
        return jsonResponse(await checkForUpdates());
      } catch (e) {
        return textResponse(String(e), { status: 502 });
      }
    }

    const updateMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/update$/);
    if (updateMatch && req.method === "POST") {
      try {
        const name = decodeURIComponent(updateMatch[1]);
        const result = await updateSkill(name);
        return jsonResponse({ ok: true, name, ...result });
      } catch (e) {
        return textResponse(String(e), { status: 500 });
      }
    }

    if (url.pathname === "/api/skills/install" && req.method === "POST") {
      try {
        const body = (await req.json()) as { source: string; ref: string; path: string; name: string };
        await installSkill(body.source, body.ref, body.path, body.name);
        return jsonResponse({ ok: true, name: body.name });
      } catch (e) {
        return textResponse(String(e), { status: 500 });
      }
    }

    const skillRmMatch = url.pathname.match(/^\/api\/skills\/([^/]+)$/);
    if (skillRmMatch && req.method === "DELETE") {
      const name = decodeURIComponent(skillRmMatch[1]);
      const removed = uninstallSkill(name);
      return jsonResponse({ removed });
    }

    if (skillRmMatch && req.method === "GET") {
      const name = decodeURIComponent(skillRmMatch[1]);
      const s = readInstalledSkill(name);
      if (!s) return textResponse("not found", { status: 404 });
      return jsonResponse(s);
    }

    if (url.pathname === "/api/runs") {
      const agentId = url.searchParams.get("agent");
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const all = getRuns();
      const filtered = agentId ? all.filter(r => r.agentId === agentId) : all;
      return jsonResponse(filtered.slice(0, limit));
    }

    const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (runMatch) {
      const id = decodeURIComponent(runMatch[1]);
      const run = getRuns().find(r => r.id === id);
      if (!run) return textResponse("not found", { status: 404 });
      return jsonResponse(run);
    }

    if (url.pathname === "/api/summon") {
      if (server.upgrade(req, { data: {} })) return undefined;
      return textResponse("upgrade failed", { status: 400 });
    }

    // ─── Static (production builds) ───
    if (existsSync(STATIC_DIR)) {
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      const fullPath = join(STATIC_DIR, filePath);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        return new Response(Bun.file(fullPath));
      }
      // SPA fallback
      const indexHtml = join(STATIC_DIR, "index.html");
      if (existsSync(indexHtml)) return new Response(Bun.file(indexHtml));
    }

    return textResponse("not found", { status: 404 });
  },
  websocket: {
    async message(ws, message) {
      let data: WSClientMessage;
      try { data = JSON.parse(String(message)) as WSClientMessage; }
      catch { ws.send(JSON.stringify({ type: "error", message: "invalid JSON" })); return; }

      if (data.type === "attach") {
        if (!attachWS(data.runId, ws)) {
          ws.send(JSON.stringify({ type: "error", message: `unknown run: ${data.runId}` }));
          ws.send(JSON.stringify({ type: "done", exitCode: 1 }));
        }
        return;
      }

      if (data.type !== "summon") return;

      if (!claudeStatus.available) {
        ws.send(JSON.stringify({ type: "error", message: "claude CLI not available" }));
        ws.send(JSON.stringify({ type: "done", exitCode: 127 }));
        return;
      }

      const agent = readAgent(data.agent);
      if (!agent) {
        ws.send(JSON.stringify({ type: "error", message: `unknown agent: ${data.agent}` }));
        ws.send(JSON.stringify({ type: "done", exitCode: 1 }));
        return;
      }

      // Resolve cwd: explicit data.cwd wins; otherwise fall back to project's cwd.
      const project = data.projectId ? readProject(data.projectId) : null;
      const instance = findInstance(project, data.instanceId);
      const requestedCwd = resolveSummonCwd(data.cwd, project);
      let cwd: string | undefined;
      if (requestedCwd) {
        const expanded = requestedCwd.replace(/^~(?=\/|$)/, homedir());
        if (!existsSync(expanded) || !statSync(expanded).isDirectory()) {
          ws.send(JSON.stringify({ type: "error", message: `cwd not a directory: ${requestedCwd}` }));
          ws.send(JSON.stringify({ type: "done", exitCode: 1 }));
          return;
        }
        cwd = expanded;
      }

      // Precedence: explicit WS request > instance override > agent default.
      const args = ["claude", "-p", "--agent", data.agent,
        "--output-format", "stream-json", "--include-partial-messages", "--verbose"];
      const model = data.model ?? instance?.model ?? agent.info.defaultModel;
      const effort = data.effort ?? instance?.effort ?? agent.info.defaultEffort;
      const permissionMode = instance?.permissionMode ?? agent.info.permissionMode;
      if (model) args.push("--model", model);
      if (effort) args.push("--effort", effort);
      if (data.maxBudgetUsd && data.maxBudgetUsd > 0) {
        args.push("--max-budget-usd", String(data.maxBudgetUsd));
      }
      if (permissionMode) args.push("--permission-mode", permissionMode);
      const appended = buildAppendedPrompt(data.agent, project);
      if (appended) args.push("--append-system-prompt", appended);
      args.push(data.prompt);

      pushRecentPrompt(data.agent, data.prompt);
      const instanceLabel = instance?.label ?? (instance ? agent.info.name : undefined);
      startRun({
        runId: data.runId,
        agentId: data.agent,
        agentName: instanceLabel ?? agent.info.name,
        prompt: data.prompt,
        model: model ?? "default",
        effort: effort ?? "default",
        cwd,
        projectId: data.projectId,
        instanceId: instance?.instanceId,
        instanceLabel,
        args,
      });
      attachWS(data.runId, ws);
    },
    close(ws) { detachWS(ws); },
  },
});

process.on("SIGTERM", () => { killAllRuns(); process.exit(0); });
process.on("SIGINT",  () => { killAllRuns(); process.exit(0); });

const allAgentIds = listAgents().map(a => a.name);
const settings = readSettings();

log.info("server.start", {
  url: `http://${HOST}:${server.port}`,
  agentsDir: AGENTS_DIR,
  agents: allAgentIds,
  firstRunComplete: settings?.firstRunComplete ?? false,
  projectsRoot: settings?.projectsRoot ?? "(not configured)",
  projects: settings ? listProjectSummaries().map(p => `${p.id}(${p.instanceCount})`) : [],
  claude: claudeStatus.available ? claudeStatus.version : "MISSING: " + claudeStatus.error,
  staticServe: existsSync(STATIC_DIR) ? STATIC_DIR : "(client/dist not built; serve via vite)",
});
