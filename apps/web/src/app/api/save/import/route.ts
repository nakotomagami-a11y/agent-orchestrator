import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { agents, db, projects } from "@agent-office/shared/services";
import { AGENTS_DIR } from "@agent-office/shared/services/paths";
import { ensureDir } from "@agent-office/shared/services/fs-atomic";

interface SaveFile {
  version: 1;
  exportedAt: string;
  project: { id: string; meta: Record<string, unknown>; memory: string };
  agents: Array<{ id: string; content: string; memory: string }>;
  office: { grid: string | null; decorations: string | null; agents: string | null; grassColor: string | null };
  history?: Array<{ agentId: string; instanceId: string; transcript: string }>;
}

function isSaveFile(data: unknown): data is SaveFile {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    d.version === 1 &&
    typeof d.exportedAt === "string" &&
    d.project !== null && typeof d.project === "object" &&
    Array.isArray(d.agents) &&
    d.office !== null && typeof d.office === "object"
  );
}

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isSaveFile(raw)) {
    return NextResponse.json({ error: "invalid_save_file", detail: "Expected version:1 project save file" }, { status: 400 });
  }

  const data = raw;

  try {
    // Restore agents
    ensureDir(AGENTS_DIR);
    for (const agent of data.agents) {
      if (typeof agent.id !== "string" || !agent.id) continue;
      if (typeof agent.content === "string" && agent.content) {
        writeFileSync(join(AGENTS_DIR, `${agent.id}.md`), agent.content, "utf8");
      }
      if (typeof agent.memory === "string") {
        agents.writeAgentMemory(agent.id, agent.memory);
      }
    }

    // Restore project
    const p = data.project;
    const meta = p.meta as Record<string, unknown>;
    const existing = projects.readProject(p.id);
    if (existing) {
      projects.updateProject(p.id, { meta, memory: p.memory });
    } else {
      projects.createProject({
        id: p.id,
        name: typeof meta.name === "string" ? meta.name : p.id,
        description: typeof meta.description === "string" ? meta.description : "",
      });
      projects.updateProject(p.id, { meta, memory: p.memory });
    }

    // Restore office settings
    const officeKeyMap: Array<[string, string | null]> = [
      ["office-grid", data.office.grid],
      ["office-decorations", data.office.decorations],
      ["office-agents", data.office.agents],
      ["office-grass-color", data.office.grassColor],
    ];
    for (const [key, value] of officeKeyMap) {
      if (value !== null && value !== undefined) db.setUiSetting(key, value);
    }

    // Restore history
    if (Array.isArray(data.history)) {
      for (const entry of data.history) {
        if (typeof entry.agentId !== "string" || typeof entry.instanceId !== "string" || typeof entry.transcript !== "string") continue;
        db.saveTranscript(entry.agentId, entry.instanceId, entry.transcript, null, null);
      }
    }

    return NextResponse.json({ ok: true, agentCount: data.agents.length });
  } catch (e) {
    return NextResponse.json({ error: "import_failed", detail: String(e) }, { status: 500 });
  }
}
