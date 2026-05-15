"use client";

import type { OfficeAgent } from "../../../hooks/use-office-agents";
import {
  AoIdentity, AoCpu, AoSparkle, AoWrench, AoShield,
  AoCheck, AoLock, AoQuestion, AoBook,
  AoFolder, AoSearch, AoTerminal, AoGlobe, AoList, AoPen,
} from "@/modules/summon/components/ao-icons";

const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Read: AoFolder,
  Write: AoPen,
  Edit: AoPen,
  Bash: AoTerminal,
  WebFetch: AoGlobe,
  WebSearch: AoSearch,
  Agent: AoList,
};

export function ConfigurationTab({ agent }: { agent: OfficeAgent }) {
  return (
    <div className="ao-tab-pane">
      <div className="ao-grid-2">
        {/* Identity */}
        <div className="ao-card">
          <div className="ao-card-header">
            <div className="ao-icon"><AoIdentity size={15} /></div>
            <div className="ao-title">Identity</div>
            <div className="ao-sub ml-auto">~/.claude/agents/{agent.id}.md</div>
          </div>
          <div className="ao-card-body">
            <KV k="Name" v={agent.name} />
            <KV k="ID" v={agent.id} mono />
            <KV k="Description" v={agent.description || <span className="ao-muted">—</span>} />
            <KV k="Room" v={agent.room || <span className="ao-muted">— unassigned</span>} />
          </div>
        </div>

        {/* Model & runtime */}
        <div className="ao-card">
          <div className="ao-card-header">
            <div className="ao-icon"><AoCpu size={15} /></div>
            <div className="ao-title">Model &amp; runtime</div>
            <span className="ao-badge ao-ok ao-dot ml-auto">ready</span>
          </div>
          <div className="ao-card-body">
            <KV k="Model" v={agent.defaultModel ?? "default"} mono />
            <KV k="Effort" v={agent.defaultEffort ?? "default"} mono />
            <KV k="Permission" v={agent.permissionMode ?? "ask"} mono />
          </div>
        </div>

        {/* Skills */}
        <div className="ao-card">
          <div className="ao-card-header">
            <div className="ao-icon"><AoSparkle size={15} /></div>
            <div className="ao-title">Skills</div>
            <div className="ao-sub ml-auto">{agent.skills.length} attached</div>
          </div>
          <div className="ao-card-body">
            {agent.skills.length === 0 ? (
              <span className="ao-muted ao-mono text-[12.5px]">none</span>
            ) : (
              <div className="ao-chips-row">
                {agent.skills.map((s) => (
                  <span key={s} className="ao-tool-chip">
                    <span className="ao-icon"><AoBook size={12} /></span>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="ao-card">
          <div className="ao-card-header">
            <div className="ao-icon"><AoWrench size={15} /></div>
            <div className="ao-title">Tools allowed</div>
            <div className="ao-sub ml-auto">{agent.tools.length} enabled</div>
          </div>
          <div className="ao-card-body">
            {agent.tools.length === 0 ? (
              <span className="ao-muted ao-mono text-[12.5px]">none</span>
            ) : (
              <div className="ao-chips-row">
                {agent.tools.map((t) => {
                  const ToolIcon = TOOL_ICONS[t] ?? AoWrench;
                  return (
                    <span key={t} className="ao-tool-chip">
                      <span className="ao-icon"><ToolIcon size={12} /></span>
                      {t}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="ao-card mt-[var(--ao-gap-section)]">
        <div className="ao-card-header">
          <div className="ao-icon"><AoShield size={15} /></div>
          <div className="ao-title">Permissions</div>
          <div className="ao-sub ml-auto">workspace policy applies</div>
        </div>
        <div className="ao-card-body ao-flush">
          <PermRow
            name="Read files"
            hint="Access source files and documents"
            state={agent.tools.includes("Read") ? "allow" : "deny"}
          />
          <PermRow
            name="Edit / write files"
            hint="Modify and create files on disk"
            state={agent.tools.includes("Edit") || agent.tools.includes("Write") ? "allow" : "deny"}
          />
          <PermRow
            name="Run shell commands"
            hint="Execute bash and system commands"
            state={agent.tools.includes("Bash") ? "ask" : "deny"}
          />
          <PermRow
            name="Open URLs / web search"
            hint="Fetch web pages and search the internet"
            state={
              agent.tools.includes("WebFetch") || agent.tools.includes("WebSearch")
                ? "allow"
                : "deny"
            }
          />
        </div>
      </div>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="ao-kv">
      <div className="ao-k">{k}</div>
      <div className={`ao-v${mono ? " ao-mono" : ""}`}>{v}</div>
    </div>
  );
}

type PermState = "allow" | "ask" | "deny";

function PermRow({ name, hint, state }: { name: string; hint: string; state: PermState }) {
  const cfg = {
    allow: { badge: "ao-ok", label: "Allowed", Icon: AoCheck },
    ask: { badge: "ao-warn", label: "Ask", Icon: AoQuestion },
    deny: { badge: "ao-bad", label: "Denied", Icon: AoLock },
  } as const;
  const { badge, label, Icon } = cfg[state];
  return (
    <div className="ao-perm-row">
      <div className="ao-left">
        <div className="ao-icon"><Icon size={12} /></div>
        <div className="ao-label">
          <div className="ao-name">{name}</div>
          <div className="ao-hint">{hint}</div>
        </div>
      </div>
      <span className={`ao-badge ${badge}`}>{label}</span>
    </div>
  );
}
