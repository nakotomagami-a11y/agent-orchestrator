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
    <div className="px-6 pt-5 pb-6 flex-1 flex flex-col">
      <div className="grid grid-cols-2 gap-[var(--ao-gap-section)] max-[760px]:grid-cols-1">
        {/* Identity */}
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoIdentity size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Identity</div>
            <div className="ml-auto text-[11.5px] text-ao-fg-2 font-mono">~/.claude/agents/{agent.id}.md</div>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            <KV k="Name" v={agent.name} />
            <KV k="ID" v={agent.id} mono />
            <KV k="Description" v={agent.description || <span className="text-ao-fg-2">—</span>} />
            <KV k="Room" v={agent.room || <span className="text-ao-fg-2">— unassigned</span>} />
          </div>
        </div>

        {/* Model & runtime */}
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoCpu size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Model &amp; runtime</div>
            <span className="ml-auto ao-badge ao-ok ao-dot">ready</span>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            <KV k="Model" v={agent.defaultModel ?? "default"} mono />
            <KV k="Effort" v={agent.defaultEffort ?? "default"} mono />
            <KV k="Permission" v={agent.permissionMode ?? "ask"} mono />
          </div>
        </div>

        {/* Skills */}
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoSparkle size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Skills</div>
            <div className="ml-auto text-[11.5px] text-ao-fg-2 font-mono">{agent.skills.length} attached</div>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            {agent.skills.length === 0 ? (
              <span className="text-ao-fg-2 font-mono text-[12.5px]">none</span>
            ) : (
              <div className="flex flex-wrap gap-[8px]">
                {agent.skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-[6px] py-[5px] pl-[8px] pr-[10px] rounded-full bg-ao-bg-3 border border-ao-line-1 text-ao-fg-0 text-[12.5px] font-mono">
                    <span className="w-[14px] h-[14px] grid place-items-center text-ao-fg-2"><AoBook size={12} /></span>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoWrench size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Tools allowed</div>
            <div className="ml-auto text-[11.5px] text-ao-fg-2 font-mono">{agent.tools.length} enabled</div>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            {agent.tools.length === 0 ? (
              <span className="text-ao-fg-2 font-mono text-[12.5px]">none</span>
            ) : (
              <div className="flex flex-wrap gap-[8px]">
                {agent.tools.map((t) => {
                  const ToolIcon = TOOL_ICONS[t] ?? AoWrench;
                  return (
                    <span key={t} className="inline-flex items-center gap-[6px] py-[5px] pl-[8px] pr-[10px] rounded-full bg-ao-bg-3 border border-ao-line-1 text-ao-fg-0 text-[12.5px] font-mono">
                      <span className="w-[14px] h-[14px] grid place-items-center text-ao-fg-2"><ToolIcon size={12} /></span>
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
      <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden mt-[var(--ao-gap-section)]">
        <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
          <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoShield size={15} /></div>
          <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Permissions</div>
          <div className="ml-auto text-[11.5px] text-ao-fg-2 font-mono">workspace policy applies</div>
        </div>
        <div>
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
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2 items-baseline [&+&]:border-t [&+&]:border-dashed [&+&]:border-[var(--ao-line-0)]">
      <div className="text-ao-fg-2 text-[12px] uppercase tracking-[0.07em] font-mono">{k}</div>
      <div className={`text-ao-fg-0 text-[13.5px]${mono ? " font-mono" : ""}`}>{v}</div>
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
    <div className="flex items-center justify-between px-[var(--ao-pad-card)] py-3 border-t border-[var(--ao-line-0)] first:border-t-0 text-[13.5px]">
      <div className="flex items-center gap-3">
        <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><Icon size={12} /></div>
        <div>
          <div className="text-ao-fg-0 font-medium">{name}</div>
          <div className="text-ao-fg-2 text-[12px] font-mono mt-0.5">{hint}</div>
        </div>
      </div>
      <span className={`ao-badge ${badge}`}>{label}</span>
    </div>
  );
}
