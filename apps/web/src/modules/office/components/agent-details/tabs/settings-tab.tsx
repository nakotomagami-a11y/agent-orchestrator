"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent, useAgentBody, useWriteAgent, useDeleteAgent } from "@/modules/agents/hooks/use-agents";
import { fromApi, toBody, type AgentFormValues } from "@/modules/agents/utils/agent-form";
import { useAgentForm } from "@/modules/agents/hooks/use-agent-form";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { MODEL_OPTS, EFFORT_OPTS } from "@agent-office/shared";
import {
  AoIdentity, AoCpu, AoSparkle, AoWrench, AoCode, AoEye,
  AoBold, AoItalic, AoHeading, AoLink, AoCheck, AoReset, AoTrash, AoClose, AoPlus,
  AoFolder, AoSearch, AoTerminal, AoGlobe, AoList, AoPen,
} from "@/modules/summon/components/ao-icons";
import { UnitPicker } from "@/components/ui/unit-picker";
import { BodyHistoryPanel } from "@/modules/agents/components/body-history-panel";


const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Read: AoFolder, Write: AoPen, Edit: AoPen, Bash: AoTerminal,
  WebFetch: AoGlobe, WebSearch: AoSearch, Agent: AoList,
};

function iconForTool(t: string) {
  const Ic = TOOL_ICONS[t] ?? AoWrench;
  return <Ic size={12} />;
}

export function SettingsTab({
  agentId,
  onAfterSave,
  onAfterDelete,
  resetRef,
}: {
  agentId: string;
  onAfterSave: () => void;
  onAfterDelete: () => void;
  resetRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const agentQ = useAgent(agentId);
  const bodyQ = useAgentBody(agentId);
  const qc = useQueryClient();
  const writeMut = useWriteAgent();
  const deleteMut = useDeleteAgent();

  const [formKey, setFormKey] = useState(0);

  if (agentQ.isLoading || bodyQ.isLoading) {
    return (
      <div className="px-6 pt-5 pb-6 flex-1 flex flex-col">
        <Skeleton width="100%" height={240} />
      </div>
    );
  }
  if (!agentQ.data) {
    return (
      <div className="px-6 pt-5 pb-6 flex-1 flex flex-col text-ao-fg-2 p-[18px]">
        Failed to load agent settings.
      </div>
    );
  }

  const initialValues = fromApi(agentQ.data, bodyQ.data ?? "");

  return (
    <SettingsForm
      key={formKey}
      initial={initialValues}
      agentId={agentId}
      resetRef={resetRef}
      onSave={async (values) => {
        const body = toBody(values);
        await writeMut.mutateAsync(body);
        qc.invalidateQueries({ queryKey: queryKeys.agents.all });
        qc.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
        qc.invalidateQueries({ queryKey: queryKeys.agents.body(agentId) });
        setFormKey((k) => k + 1);
        onAfterSave();
      }}
      onDelete={async () => {
        if (!window.confirm(`Delete agent "${agentId}"? This cannot be undone.`)) return;
        await deleteMut.mutateAsync(agentId);
        qc.invalidateQueries({ queryKey: queryKeys.agents.all });
        onAfterDelete();
      }}
      saving={writeMut.isPending}
      deleting={deleteMut.isPending}
    />
  );
}

function SettingsForm({
  initial,
  agentId,
  onSave,
  onDelete,
  saving,
  deleting,
  resetRef,
}: {
  initial: AgentFormValues;
  agentId: string;
  onSave: (values: AgentFormValues) => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
  deleting: boolean;
  resetRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const {
    v, setV,
    errors,
    serverError,
    view, setView,
    skillInput, setSkillInput,
    toolInput, setToolInput,
    dirty,
    skills,
    tools,
    set,
    setSkills,
    setTools,
    addSkill,
    addTool,
    handleSave,
    handleDiscard,
  } = useAgentForm(initial, onSave);

  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (resetRef) resetRef.current = handleDiscard;
  }, [resetRef, handleDiscard]);

  const promptLines = v.body.split("\n");

  const AVAIL_TOOLS = ["Read", "Write", "Edit", "Bash", "WebFetch", "WebSearch", "Agent"];

  return (
    <div className="px-6 pt-5 pb-6 flex-1 flex flex-col">
      {/* ── Identity section ── */}
      <div className="mb-[var(--ao-gap-section)]">
        <div className="flex items-center gap-[10px] px-1 pb-[10px]">
          <span className="w-1 h-[14px] rounded-[2px] bg-[var(--ao-accent)] shrink-0" />
          <h3 className="m-0 text-[13px] font-semibold text-ao-fg-0 uppercase tracking-[0.08em]">Identity</h3>
          <span className="ml-auto text-ao-fg-2 font-mono text-[11.5px]">how this agent is named and described</span>
        </div>
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoIdentity size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Basic info</div>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            <div className="grid grid-cols-2 gap-[var(--ao-gap-section)] max-[760px]:grid-cols-1">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2">Name</label>
                <div className="flex items-center gap-2 px-3 py-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md text-ao-fg-0 text-[13.5px] transition-[border-color,box-shadow] duration-[120ms] focus-within:border-ao-accent-line focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)]">
                  <input value={v.name} onChange={set("name")} placeholder="My Agent" className="flex-1 bg-transparent border-0 outline-none w-full text-ao-fg-0 text-[13.5px]" />
                </div>
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2">ID (slug) <span className="text-ao-accent">·</span></label>
                <div className="flex items-center gap-2 px-3 py-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md text-ao-fg-0 text-[13.5px] transition-[border-color,box-shadow] duration-[120ms] focus-within:border-ao-accent-line focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)] font-mono">
                  <span className="text-ao-fg-3 font-mono text-[12px]">~/.claude/agents/</span>
                  <input value={v.id} disabled title="ID cannot be changed after creation" className="flex-1 bg-transparent border-0 outline-none w-full text-ao-fg-0 text-[13.5px] font-mono text-[12.5px]" />
                  <span className="text-ao-fg-3 font-mono text-[12px]">.md</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-[6px] mt-3">
              <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2">Description</label>
              <div className="flex items-center gap-2 px-3 py-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md text-ao-fg-0 text-[13.5px] transition-[border-color,box-shadow] duration-[120ms] focus-within:border-ao-accent-line focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)]">
                <input value={v.desc} onChange={set("desc")} placeholder="One-sentence description…" className="flex-1 bg-transparent border-0 outline-none w-full text-ao-fg-0 text-[13.5px]" />
              </div>
              <div className="text-[11.5px] text-ao-fg-2 font-mono">{v.desc.length} / 240 chars</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Runtime section ── */}
      <div className="mb-[var(--ao-gap-section)]">
        <div className="flex items-center gap-[10px] px-1 pb-[10px]">
          <span className="w-1 h-[14px] rounded-[2px] bg-[var(--ao-accent)] shrink-0" />
          <h3 className="m-0 text-[13px] font-semibold text-ao-fg-0 uppercase tracking-[0.08em]">Runtime</h3>
          <span className="ml-auto text-ao-fg-2 font-mono text-[11.5px]">model and execution policy</span>
        </div>
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoCpu size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Execution</div>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            <div className="grid grid-cols-2 gap-[var(--ao-gap-section)] max-[760px]:grid-cols-1">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2">Model</label>
                <div className="flex items-center gap-2 px-3 py-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md text-ao-fg-0 text-[13.5px] transition-[border-color,box-shadow] duration-[120ms] focus-within:border-ao-accent-line focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)]">
                  <select className="ao-select flex-1 bg-transparent border-0 outline-none w-full text-ao-fg-0 text-[13.5px]" value={v.model} onChange={set("model")}>
                    {MODEL_OPTS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2">Effort</label>
                <div className="flex items-center gap-2 px-3 py-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md text-ao-fg-0 text-[13.5px] transition-[border-color,box-shadow] duration-[120ms] focus-within:border-ao-accent-line focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)]">
                  <select className="ao-select flex-1 bg-transparent border-0 outline-none w-full text-ao-fg-0 text-[13.5px]" value={v.effort} onChange={set("effort")}>
                    {EFFORT_OPTS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[6px] mt-[14px]">
              <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2">Permission mode</label>
              <div className="grid grid-cols-3 gap-[6px] p-1 bg-ao-bg-4 border border-ao-line-1 rounded-ao-md">
                <button type="button" className={`px-3 py-2 rounded-[8px] text-[12.5px] flex flex-col items-start gap-0.5 text-left transition-[background] duration-[120ms] hover:bg-ao-bg-3 ${v.pm === "auto" ? "bg-[var(--ao-accent-soft)] [box-shadow:inset_0_0_0_1px_var(--ao-accent-line)]" : "text-ao-fg-1"}`} onClick={() => setV((p) => ({ ...p, pm: "auto" }))}>
                  <span className={`font-semibold ${v.pm === "auto" ? "text-[var(--ao-accent)]" : "text-ao-fg-1"}`}>Auto</span>
                  <span className={`text-[10.5px] font-mono tracking-[0.02em] ${v.pm === "auto" ? "text-[color-mix(in_oklab,var(--ao-accent)_60%,var(--ao-fg-1))]" : "text-ao-fg-3"}`}>trust all tool calls</span>
                </button>
                <button type="button" className={`px-3 py-2 rounded-[8px] text-[12.5px] flex flex-col items-start gap-0.5 text-left transition-[background] duration-[120ms] hover:bg-ao-bg-3 ${v.pm === "ask" ? "bg-[var(--ao-accent-soft)] [box-shadow:inset_0_0_0_1px_var(--ao-accent-line)]" : "text-ao-fg-1"}`} onClick={() => setV((p) => ({ ...p, pm: "ask" }))}>
                  <span className={`font-semibold ${v.pm === "ask" ? "text-[var(--ao-accent)]" : "text-ao-fg-1"}`}>Ask</span>
                  <span className={`text-[10.5px] font-mono tracking-[0.02em] ${v.pm === "ask" ? "text-[color-mix(in_oklab,var(--ao-accent)_60%,var(--ao-fg-1))]" : "text-ao-fg-3"}`}>prompt on destructive ops</span>
                </button>
                <button type="button" className={`px-3 py-2 rounded-[8px] text-[12.5px] flex flex-col items-start gap-0.5 text-left transition-[background] duration-[120ms] hover:bg-ao-bg-3 ${v.pm === "plan" ? "bg-[var(--ao-accent-soft)] [box-shadow:inset_0_0_0_1px_var(--ao-accent-line)]" : "text-ao-fg-1"}`} onClick={() => setV((p) => ({ ...p, pm: "plan" }))}>
                  <span className={`font-semibold ${v.pm === "plan" ? "text-[var(--ao-accent)]" : "text-ao-fg-1"}`}>Plan</span>
                  <span className={`text-[10.5px] font-mono tracking-[0.02em] ${v.pm === "plan" ? "text-[color-mix(in_oklab,var(--ao-accent)_60%,var(--ao-fg-1))]" : "text-ao-fg-3"}`}>read-only mode</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-[6px] mt-[14px]">
              <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2">Room <span className="text-ao-fg-2 normal-case tracking-[0] font-[var(--ao-font-sans)] font-normal">· optional</span></label>
              <div className="flex items-center gap-2 px-3 py-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md text-ao-fg-0 text-[13.5px] transition-[border-color,box-shadow] duration-[120ms] focus-within:border-ao-accent-line focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)]">
                <input value={v.room} onChange={set("room")} placeholder="e.g. Build" className="flex-1 bg-transparent border-0 outline-none w-full text-ao-fg-0 text-[13.5px]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Capabilities section ── */}
      <div className="mb-[var(--ao-gap-section)]">
        <div className="flex items-center gap-[10px] px-1 pb-[10px]">
          <span className="w-1 h-[14px] rounded-[2px] bg-[var(--ao-accent)] shrink-0" />
          <h3 className="m-0 text-[13px] font-semibold text-ao-fg-0 uppercase tracking-[0.08em]">Capabilities</h3>
          <span className="ml-auto text-ao-fg-2 font-mono text-[11.5px]">{skills.length} skills · {tools.length} tools</span>
        </div>
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoWrench size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Skills &amp; tools</div>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2"><AoSparkle size={11} /> Skills</label>
              <div className="flex flex-wrap gap-[6px] p-2 pl-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md min-h-[42px] items-center focus-within:border-[var(--ao-accent-line)] focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)]">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-[6px] py-1 pl-[10px] pr-1 bg-[var(--ao-accent-soft)] border border-[var(--ao-accent-line)] rounded-full font-mono text-[12px] text-[var(--ao-accent)]">
                    {s}
                    <button type="button" className="w-4 h-4 grid place-items-center rounded-full text-current opacity-60 hover:opacity-100 hover:bg-white/[0.06]" onClick={() => setSkills(skills.filter((x) => x !== s))} aria-label="remove">
                      <AoClose size={10} />
                    </button>
                  </span>
                ))}
                <input
                  className="ao-add-chip bg-transparent border-0 outline-none flex-1 min-w-[100px] text-ao-fg-0 font-mono text-[12.5px]"
                  placeholder={skills.length === 0 ? "add a skill - frontend-design, research, …" : "+ add skill"}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); } }}
                />
              </div>
              <div className="text-[11.5px] text-ao-fg-2 font-mono">enter to add · comma-separated</div>
            </div>

            <div className="flex flex-col gap-[6px] mt-[14px]">
              <label className="text-[10.5px] uppercase tracking-[0.1em] text-ao-fg-2 font-mono flex items-center gap-2"><AoWrench size={11} /> Tools allowed</label>
              <div className="flex flex-wrap gap-[6px] p-2 pl-[10px] bg-ao-bg-4 border border-ao-line-1 rounded-ao-md min-h-[42px] items-center focus-within:border-[var(--ao-accent-line)] focus-within:[box-shadow:0_0_0_3px_var(--ao-accent-softer)]">
                {tools.map((t) => (
                  <span key={t} className="inline-flex items-center gap-[6px] py-1 pl-[10px] pr-1 bg-ao-bg-3 border border-ao-line-1 rounded-full font-mono text-[12px] text-ao-fg-0">
                    <span className="text-ao-fg-2">{iconForTool(t)}</span>
                    {t}
                    <button type="button" className="w-4 h-4 grid place-items-center rounded-full text-current opacity-60 hover:opacity-100 hover:bg-white/[0.06]" onClick={() => setTools(tools.filter((x) => x !== t))} aria-label="remove">
                      <AoClose size={10} />
                    </button>
                  </span>
                ))}
                <input
                  className="ao-add-chip bg-transparent border-0 outline-none flex-1 min-w-[100px] text-ao-fg-0 font-mono text-[12.5px]"
                  placeholder="+ add tool"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTool(); } }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-[6px]">
                <span className="text-ao-fg-2 font-mono text-[11.5px]">suggested:</span>
                {AVAIL_TOOLS.filter((t) => !tools.includes(t)).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="inline-flex items-center gap-[6px] py-[5px] pl-[8px] pr-[10px] rounded-full bg-ao-bg-3 border border-ao-line-1 text-ao-fg-0 text-[12.5px] font-mono cursor-pointer hover:bg-ao-bg-4 hover:border-ao-line-2 transition-[background,border-color] duration-[120ms]"
                    onClick={() => setTools([...tools, t])}
                  >
                    <span className="text-ao-fg-2">{iconForTool(t)}</span>
                    {t}
                    <AoPlus size={10} className="text-[var(--ao-fg-3)]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Appearance section ── */}
      <div className="mb-[var(--ao-gap-section)]">
        <div className="flex items-center gap-[10px] px-1 pb-[10px]">
          <span className="w-1 h-[14px] rounded-[2px] bg-[var(--ao-accent)] shrink-0" />
          <h3 className="m-0 text-[13px] font-semibold text-ao-fg-0 uppercase tracking-[0.08em]">Appearance</h3>
          <span className="ml-auto text-ao-fg-2 font-mono text-[11.5px]">avatar shown in the office floor and sidebar</span>
        </div>
        <div className="bg-ao-bg-2 border border-ao-line-1 rounded-ao-lg overflow-hidden">
          <div className="flex items-center gap-[10px] px-[var(--ao-pad-card)] py-[14px] border-b border-[var(--ao-line-0)]">
            <div className="w-[28px] h-[28px] grid place-items-center rounded-[8px] bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 shrink-0"><AoIdentity size={15} /></div>
            <div className="text-[13px] font-semibold tracking-[0.02em] text-ao-fg-0">Avatar</div>
            <span className="ml-auto text-[11.5px] font-mono text-ao-fg-3">{v.unit ? "custom selection" : "auto from name"}</span>
          </div>
          <div className="p-[var(--ao-pad-card)]">
            <UnitPicker
              value={v.unit}
              onChange={(val) => setV((p) => ({ ...p, unit: val }))}
              agentName={v.name}
            />
          </div>
        </div>
      </div>

      {/* ── System prompt section ── */}
      <div className="mb-[var(--ao-gap-section)]">
        <div className="flex items-center gap-[10px] px-1 pb-[10px]">
          <span className="w-1 h-[14px] rounded-[2px] bg-[var(--ao-accent)] shrink-0" />
          <h3 className="m-0 text-[13px] font-semibold text-ao-fg-0 uppercase tracking-[0.08em]">System prompt</h3>
          <span className="ml-auto text-ao-fg-2 font-mono text-[11.5px]">
            markdown body · {v.body.length.toLocaleString()} chars · ~{Math.round(v.body.length / 4)} tokens
          </span>
        </div>

        <div className="ao-markdown-editor bg-ao-bg-4 border border-ao-line-1 rounded-ao-md overflow-hidden">
          <div className="flex gap-0.5 p-[6px] bg-black/[0.18] border-b border-[var(--ao-line-0)]">
            <button type="button" className={`inline-flex items-center gap-[6px] px-3 py-[5px] rounded-[6px] font-mono text-[11.5px] ${view === "write" ? "bg-ao-bg-2 text-ao-fg-0" : "text-ao-fg-2"}`} onClick={() => setView("write")}>
              <AoCode size={12} /> Write
            </button>
            <button type="button" className={`inline-flex items-center gap-[6px] px-3 py-[5px] rounded-[6px] font-mono text-[11.5px] ${view === "preview" ? "bg-ao-bg-2 text-ao-fg-0" : "text-ao-fg-2"}`} onClick={() => setView("preview")}>
              <AoEye size={12} /> Preview
            </button>
            <div className="ml-auto flex gap-0.5">
              <button type="button" className="w-[28px] inline-flex items-center justify-center p-0 rounded-[6px] text-ao-fg-2 hover:text-ao-fg-0" aria-label="heading" onClick={() => setV((p) => ({ ...p, body: p.body + "\n## " }))}><AoHeading size={13} /></button>
              <button type="button" className="w-[28px] inline-flex items-center justify-center p-0 rounded-[6px] text-ao-fg-2 hover:text-ao-fg-0" aria-label="bold" onClick={() => setV((p) => ({ ...p, body: p.body + "****" }))}><AoBold size={13} /></button>
              <button type="button" className="w-[28px] inline-flex items-center justify-center p-0 rounded-[6px] text-ao-fg-2 hover:text-ao-fg-0" aria-label="italic" onClick={() => setV((p) => ({ ...p, body: p.body + "**" }))}><AoItalic size={13} /></button>
              <button type="button" className="w-[28px] inline-flex items-center justify-center p-0 rounded-[6px] text-ao-fg-2 hover:text-ao-fg-0" aria-label="link" onClick={() => setV((p) => ({ ...p, body: p.body + "[](url)" }))}><AoLink size={13} /></button>
              <button type="button" className="w-[28px] inline-flex items-center justify-center p-0 rounded-[6px] text-ao-fg-2 hover:text-ao-fg-0" aria-label="code" onClick={() => setV((p) => ({ ...p, body: p.body + "``" }))}><AoCode size={13} /></button>
            </div>
            <button
              type="button"
              className={`ml-auto text-[11px] px-[8px] py-[3px] rounded-[4px] border transition-colors ${historyOpen ? "border-[var(--ao-accent)] text-[var(--ao-accent)]" : "border-[var(--ao-line)] text-[var(--ao-fg-3)] hover:text-[var(--ao-fg-2)]"}`}
              onClick={() => setHistoryOpen((o) => !o)}
              aria-expanded={historyOpen}
              aria-label="Toggle prompt version history"
            >
              History
            </button>
          </div>

          {historyOpen && (
            <div className="border-b border-[var(--ao-line)] bg-[var(--ao-bg-2)]">
              <BodyHistoryPanel
                agentId={agentId}
                onRestore={(restored) => {
                  setV((prev) => ({ ...prev, body: restored }));
                  setHistoryOpen(false);
                }}
              />
            </div>
          )}

          {view === "write" ? (
            <div className="ao-editor">
              <div className="ao-gutter">
                {promptLines.map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                className="ao-code resize-none"
                value={v.body}
                onChange={(e) => setV((p) => ({ ...p, body: e.target.value }))}
                spellCheck={false}
                style={{ height: Math.max(200, promptLines.length * 20) }}
              />
            </div>
          ) : (
            <div className="ao-preview">
              <MarkdownPreview md={v.body} />
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {(errors.length > 0 || serverError) && (
        <div className="bg-[var(--ao-bad-soft)] border border-[var(--ao-bad)] rounded-[var(--ao-radius-md)] px-[14px] py-[10px] text-[var(--ao-bad)] text-[13px] mb-[14px]">
          {serverError ?? errors.join(" · ")}
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 flex items-center gap-3 px-6 py-[12px] bg-ao-bg-1 border-t border-ao-line-1 mt-4 -mx-6 -mb-6 shrink-0 [box-shadow:0_-1px_0_var(--ao-line-0)]">
        {dirty ? (
          <span className="inline-flex items-center gap-[7px] font-mono text-[12px] text-[var(--ao-warn)]">
            <span className="w-[6px] h-[6px] rounded-full bg-[var(--ao-warn)] shadow-[0_0_8px_var(--ao-warn)] animate-[ao-pulse_1.6s_infinite] shrink-0" /> Unsaved changes
          </span>
        ) : (
          <span className="text-[var(--ao-fg-3)] text-[12px] font-[var(--ao-font-mono)]">No changes</span>
        )}
        <div className="ml-auto flex items-center gap-[6px]">
          <button
            type="button"
            className="inline-flex items-center gap-[6px] px-[12px] py-[7px] rounded-[8px] text-[12.5px] font-medium border border-transparent text-ao-fg-2 hover:bg-ao-bg-3 hover:text-ao-fg-0 hover:border-ao-line-1 transition-[background,border-color,color] duration-[120ms] disabled:opacity-40"
            onClick={handleDiscard}
            disabled={!dirty}
          >
            Discard
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-[6px] px-[12px] py-[7px] rounded-[8px] text-[12.5px] font-medium bg-[var(--ao-bad-soft)] border border-[rgba(217,83,79,0.28)] text-[var(--ao-bad)] hover:bg-[rgba(217,83,79,0.22)] transition-[background] duration-[120ms] disabled:opacity-40"
            onClick={onDelete}
            disabled={deleting}
          >
            <AoTrash size={12} /> Delete
          </button>
          <div className="w-px h-[18px] bg-ao-line-1 mx-[2px]" />
          <button
            type="button"
            className="inline-flex items-center gap-[6px] px-[12px] py-[7px] rounded-[8px] text-[12.5px] font-medium bg-ao-bg-3 border border-ao-line-1 text-ao-fg-1 hover:bg-ao-bg-4 hover:border-ao-line-2 hover:text-ao-fg-0 transition-[background,border-color,color] duration-[120ms] disabled:opacity-40"
            onClick={handleDiscard}
            disabled={!dirty}
          >
            <AoReset size={12} /> Revert
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] rounded-[8px] text-[12.5px] font-semibold bg-[var(--ao-accent)] text-white hover:bg-[color-mix(in_oklab,var(--ao-accent)_90%,white)] transition-[background] duration-[120ms] disabled:opacity-40"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            <AoCheck size={13} /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkdownPreview({ md }: { md: string }) {
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(<p key={out.length} dangerouslySetInnerHTML={{ __html: inline(para.join(" ")) }} />);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    out.push(<ul key={out.length}>{list.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(it) }} />)}</ul>);
    list = [];
  };

  for (const raw of md.split("\n")) {
    const ln = raw.trimEnd();
    if (/^# /.test(ln)) { flushList(); flushPara(); out.push(<h1 key={out.length} dangerouslySetInnerHTML={{ __html: inline(ln.slice(2)) }} />); continue; }
    if (/^## /.test(ln)) { flushList(); flushPara(); out.push(<h2 key={out.length} dangerouslySetInnerHTML={{ __html: inline(ln.slice(3)) }} />); continue; }
    if (/^### /.test(ln)) { flushList(); flushPara(); out.push(<h2 key={out.length} dangerouslySetInnerHTML={{ __html: inline(ln.slice(4)) }} />); continue; }
    if (/^[-*] /.test(ln)) { flushPara(); list.push(ln.slice(2)); continue; }
    if (!ln.trim()) { flushPara(); flushList(); continue; }
    flushList(); para.push(ln);
  }
  flushPara(); flushList();
  return <>{out}</>;
}
