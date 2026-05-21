"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { AddAgentModal } from "@/modules/projects/components/add-agent-modal";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import type { OfficeAgent } from "../hooks/use-office-agents";
import type { OfficeView } from "../hooks/use-office-store";
import { DevServerButton } from "./office-toolbar";

export type OfficeFilter = "all" | "live" | "idle";

export type CardsOfficeProps = {
  agents: OfficeAgent[];
  isLoading: boolean;
  hasProject: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: OfficeFilter;
  setFilter: (f: OfficeFilter) => void;
  view: OfficeView;
  setView: (v: OfficeView) => void;
  projectId: string | null;
  projectName: string | null;
  rosterCount: number;
  workingCount: number;
};

export function CardsOffice({
  agents,
  isLoading,
  hasProject,
  selectedId,
  onSelect,
  filter,
  setFilter,
  view,
  setView,
  projectId,
  projectName,
  rosterCount,
  workingCount,
}: CardsOfficeProps) {
  const t = useTranslations();
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const setActiveId = useActiveProjectStore((s) => s.setId);

  const togglePin = (id: string) =>
    setPinned(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const liveAgents = agents.filter(a => a.status === "working" || a.status === "thinking" || a.status === "error");
  const idleAgents = agents.filter(a => a.status !== "working" && a.status !== "thinking" && a.status !== "error");

  const sort = (list: OfficeAgent[]) =>
    [...list].sort((a, b) => (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0));

  const showLive = filter === "all" || filter === "live";
  const showIdle = filter === "all" || filter === "idle";

  function renderBody() {
    if (isLoading) {
      return <CardsOfficeGhostBody />;
    }
    if (hasProject && agents.length === 0) {
      return (
        <EmptyState
          icon="users"
          title={t("office.empty_roster_title")}
          description={t("office.empty_roster_hint")}
          action={
            <Button href={PAGE_ROUTES.project(projectId!)}>
              Add agents
            </Button>
          }
        />
      );
    }
    if (!hasProject && agents.length === 0) {
      return (
        <EmptyState
          icon="users"
          title={t("office.no_project_selected")}
          description={t("office.no_project_hint")}
          action={
            <Button href={PAGE_ROUTES.projects}>
              Open projects
            </Button>
          }
        />
      );
    }

    return (
      <>
        {workingCount > 0 && filter === "all" && (
          <div className="of-quickchat">
            <div className="grid place-items-center bg-acc-faint text-acc shrink-0 w-8 h-8 rounded-lg border border-[var(--acc-tint)]"><Icon name="activity" size={14} /></div>
            <div className="text-txt-2 flex-1 text-[13.5px]">
              <span className="text-txt font-semibold">{workingCount} agent{workingCount === 1 ? "" : "s"} working</span>
              {" - open one to follow along, or jump to the activity feed."}
            </div>
            <div className="flex gap-2">
              <Link href={PAGE_ROUTES.activity} className="inline-flex items-center gap-[6px] bg-bg-3 border border-line text-txt-2 cursor-pointer px-[10px] py-[6px] rounded-[8px] text-[12.5px] transition-[background,color] duration-[120ms] hover:bg-bg-2 hover:text-txt hover:border-line-2 no-underline">
                <Icon name="activity" size={12} /> Activity
              </Link>
            </div>
          </div>
        )}

        {showLive && liveAgents.length > 0 && (
          <>
            <div className="flex items-center gap-[10px] my-[6px] mb-3">
              <h2 className="font-semibold uppercase text-txt-3 flex items-center gap-2 m-0 text-[11.5px] tracking-[0.1em]">
                Live <span className="pip live">{liveAgents.length} working</span>
              </h2>
              <span className="flex-1 h-px bg-line" />
              <span className="text-txt-4 font-mono text-[11px]">now</span>
            </div>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] max-[1024px]:[grid-template-columns:repeat(2,1fr)] max-[600px]:[grid-template-columns:1fr] gap-[14px] mb-[22px]">
              {sort(liveAgents).map(a => (
                <OfficeCard
                  key={a.id}
                  agent={a}
                  selected={selectedId === a.id}
                  pinned={pinned.has(a.id)}
                  onSelect={onSelect}
                  onPin={togglePin}
                />
              ))}
            </div>
          </>
        )}

        {showIdle && idleAgents.length > 0 && (
          <>
            <div className="flex items-center gap-[10px] my-[6px] mb-3">
              <h2 className="font-semibold uppercase text-txt-3 flex items-center gap-2 m-0 text-[11.5px] tracking-[0.1em]">
                Idle <span className="pip">{idleAgents.length}</span>
              </h2>
              <span className="flex-1 h-px bg-line" />
              <span className="text-txt-4 font-mono text-[11px]">ready when you are</span>
            </div>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] max-[1024px]:[grid-template-columns:repeat(2,1fr)] max-[600px]:[grid-template-columns:1fr] gap-[14px] mb-[22px]">
              {sort(idleAgents).map(a => (
                <OfficeCard
                  key={a.id}
                  agent={a}
                  selected={selectedId === a.id}
                  pinned={pinned.has(a.id)}
                  onSelect={onSelect}
                  onPin={togglePin}
                />
              ))}
              <button type="button" className="of-card add-card" onClick={() => setAddOpen(true)}>
                <div>
                  <div className="ico"><Icon name="plus" size={18} /></div>
                  <div className="font-semibold text-txt text-[14px]">Add an agent</div>
                  <div className="font-mono text-[11px] text-txt-3 mt-1">
                    summon from your roster
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {filter === "live" && liveAgents.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-txt-3 text-center py-[60px] px-6 text-[14px]">
            <div className="bg-bg-3 border border-line grid place-items-center text-txt-4 w-14 h-14 rounded-[14px] mx-auto mb-[14px]"><Icon name="activity" size={22} /></div>
            <div>No agents are working right now.</div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      <header className="border-b border-line shrink-0 flex items-center gap-[16px] px-[28px] pt-[18px] pb-[14px]">
        <div className="flex flex-col gap-[2px]">
          <h1 className="font-bold flex items-baseline gap-[10px] m-0 text-[22px] tracking-[-0.01em]">
            The office
            <span className="text-txt-3 font-normal font-[var(--font-mono)] text-[12.5px] tracking-normal">
              {projectId ? (
                <>
                  · <span className="text-txt-2">{rosterCount} agent{rosterCount === 1 ? "" : "s"}</span>
                  {projectName ? <> in {projectName}</> : null}
                  {" · "}
                  <span className="text-txt-2" style={workingCount > 0 ? { color: "var(--working)" } : undefined}>
                    {workingCount} working
                  </span>
                </>
              ) : (
                <> · {agents.length} agent{agents.length === 1 ? "" : "s"}</>
              )}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-[6px] ml-[4px]">
          <button
            type="button"
            className={cn("inline-flex items-center gap-[7px] bg-bg-2 border border-line rounded-full text-txt-2 cursor-pointer px-[12px] py-[6px] font-[var(--font-mono)] text-[12px] transition-[border-color,color,background] duration-[120ms] hover:text-txt hover:border-line-2", filter === "all" && "bg-acc-faint text-acc border-acc-tint")}
            onClick={() => setFilter("all")}
          >
            All <span className={cn("bg-bg-3 border border-line text-txt-2 rounded-full px-[7px] text-[10.5px]", filter === "all" && "bg-acc-faint text-acc border-acc-tint")}>{agents.length}</span>
          </button>
          <button
            type="button"
            className={cn("inline-flex items-center gap-[7px] bg-bg-2 border border-line rounded-full text-txt-2 cursor-pointer px-[12px] py-[6px] font-[var(--font-mono)] text-[12px] transition-[border-color,color,background] duration-[120ms] hover:text-txt hover:border-line-2", filter === "live" && "bg-acc-faint text-acc border-acc-tint")}
            onClick={() => setFilter("live")}
          >
            <span className="rounded-full w-[6px] h-[6px] inline-block" style={{ background: "var(--working)", boxShadow: "0 0 6px var(--working)" }} />
            live <span className={cn("bg-bg-3 border border-line text-txt-2 rounded-full px-[7px] text-[10.5px]", filter === "live" && "bg-acc-faint text-acc border-acc-tint")}>{liveAgents.length}</span>
          </button>
          <button
            type="button"
            className={cn("inline-flex items-center gap-[7px] bg-bg-2 border border-line rounded-full text-txt-2 cursor-pointer px-[12px] py-[6px] font-[var(--font-mono)] text-[12px] transition-[border-color,color,background] duration-[120ms] hover:text-txt hover:border-line-2", filter === "idle" && "bg-acc-faint text-acc border-acc-tint")}
            onClick={() => setFilter("idle")}
          >
            <span className="rounded-full w-[6px] h-[6px] inline-block bg-txt-4" />
            idle <span className={cn("bg-bg-3 border border-line text-txt-2 rounded-full px-[7px] text-[10.5px]", filter === "idle" && "bg-acc-faint text-acc border-acc-tint")}>{idleAgents.length}</span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-[8px]">
          {projectId && <DevServerButton projectId={projectId} />}
          <div className="inline-flex bg-bg-2 border border-line p-[3px] rounded-[8px]">
            <button
              type="button"
              className={cn("inline-flex items-center gap-[6px] text-txt-3 px-[12px] py-[6px] rounded-[5px] text-[12.5px] transition-[background,color] duration-[120ms]", view === "iso" && "bg-bg-3 text-txt [box-shadow:inset_0_0_0_1px_var(--line)]")}
              onClick={() => setView("iso")}
            >
              <Icon name="map" size={12} /> Iso
            </button>
            <button
              type="button"
              className={cn("inline-flex items-center gap-[6px] text-txt-3 px-[12px] py-[6px] rounded-[5px] text-[12.5px] transition-[background,color] duration-[120ms]", view === "cards" && "bg-bg-3 text-txt [box-shadow:inset_0_0_0_1px_var(--line)]")}
              onClick={() => setView("cards")}
            >
              <Icon name="grid" size={12} /> Cards
            </button>
          </div>
          <button type="button" className="inline-flex items-center gap-[6px] bg-acc font-semibold cursor-pointer px-[14px] py-[8px] text-white rounded-[9px] text-[13px] transition-[background] duration-[120ms] hover:bg-[var(--acc-hover)] border-none" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={13} /> Add agent
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-[28px] py-[16px] pb-[28px]">
        {renderBody()}
      </div>

      <AddAgentModal
        open={addOpen}
        projectId={projectId}
        onClose={() => setAddOpen(false)}
        onProjectChange={(id) => setActiveId(id)}
      />
    </div>
  );
}

function CardsOfficeGhostBody() {
  return (
    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] max-[1024px]:[grid-template-columns:repeat(2,1fr)] max-[600px]:[grid-template-columns:1fr] gap-[14px]">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="of-card bg-bg-2 border border-line flex flex-col gap-[12px] cursor-pointer relative overflow-hidden rounded-[14px] p-4 opacity-50">
          <div className="grid items-center gap-[12px] [grid-template-columns:48px_1fr_auto]">
            <div className="bg-bg-3 w-[48px] h-[48px] rounded-[12px]" />
            <div className="min-w-0">
              <div className="h-[14px] w-[60%] bg-bg-3 rounded mb-[6px]" />
              <div className="h-[10px] w-[40%] bg-bg-3 rounded" />
            </div>
          </div>
          <div className="border border-line bg-bg-1 relative rounded-[10px] p-[10px_12px]">
            <div className="h-[10px] w-[30%] bg-bg-3 rounded mb-[6px]" />
            <div className="h-3 w-[80%] bg-bg-3 rounded" />
          </div>
          <div className="flex items-center gap-[10px] border-t border-line pt-[10px] mt-auto">
            <div className="h-[22px] w-[70px] bg-bg-3 rounded-md" />
            <div className="h-[22px] w-[50px] bg-bg-3 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficeCard({
  agent,
  selected,
  pinned,
  onSelect,
  onPin,
}: {
  agent: OfficeAgent;
  selected: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
}) {
  const router = useRouter();
  const isLive = agent.status === "working" || agent.status === "thinking";
  const isError = agent.status === "error";

  const stateLabel =
    agent.taskKind === "tool" ? "doing now" :
    agent.taskKind === "think" ? "thinking" :
    "status";

  const stateText = agent.task ?? "Idle - ready when you are";

  const modelColor =
    (agent.defaultModel ?? "").includes("haiku") ? "var(--done)" :
    (agent.defaultModel ?? "").includes("opus") ? "#ffcb6b" :
    "#c792ea";

  const statusText =
    agent.status === "working" ? "running" :
    agent.status === "thinking" ? "thinking" :
    agent.status === "error" ? "error" :
    "idle";

  return (
    <div
      className={cn(
        "of-card bg-bg-2 border border-line flex flex-col gap-[12px] cursor-pointer relative overflow-hidden rounded-[14px] p-4 transition-[background,border-color,transform,box-shadow] duration-[120ms] group hover:bg-bg-3 hover:border-line-2 hover:[transform:translateY(-1px)] hover:[box-shadow:var(--shadow-2)]",
        isLive && "live",
        isError && "error",
        selected && "selected",
        pinned && "pinned",
      )}
      onClick={() => onSelect(agent.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(agent.id)}
    >
      <div className="grid items-center gap-[12px] [grid-template-columns:48px_1fr_auto]">
        <div className="bg-bg-3 border border-line grid place-items-center relative overflow-visible w-[48px] h-[48px] rounded-[12px]">
          <AgentAvatar unit={agent.unitChoice} size={42} />
          <span className={cn(
            "absolute rounded-full w-[14px] h-[14px] bottom-[-2px] right-[-2px] border-2 border-bg-2",
            agent.status === "working" ? "bg-[var(--working)] [box-shadow:0_0_8px_var(--working)]" :
            agent.status === "thinking" ? "bg-[var(--thinking)]" :
            isError ? "bg-[var(--error)]" :
            "bg-txt-4",
          )} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-txt flex items-center gap-[6px] whitespace-nowrap overflow-hidden text-ellipsis text-[15px]">
            {pinned && <Icon name="pin" size={11} className="text-acc shrink-0" />}
            {agent.name}
          </div>
          <div className="text-txt-3 whitespace-nowrap overflow-hidden text-ellipsis font-[var(--font-mono)] text-[11px] mt-[2px]">
            {agent.id}
          </div>
        </div>
        <span className={cn(
          "inline-flex items-center gap-[6px] rounded-full bg-bg-3 border border-line text-txt-3 lowercase shrink-0 px-[9px] py-[4px] font-[var(--font-mono)] text-[10.5px] tracking-[0.04em]",
          agent.status === "working" && "status-chip live",
          agent.status === "thinking" && "status-chip busy",
          isError && "status-chip error",
        )}>
          <span className={cn(
            "rounded-full w-[5px] h-[5px]",
            agent.status === "working" ? "bg-current [box-shadow:0_0_5px_currentColor]" : "bg-current",
          )} />
          {statusText}
        </span>
      </div>

      <div className={cn(
        "border border-line bg-bg-1 relative rounded-[10px] p-[10px_12px]",
        isLive && "state-box",
      )}>
        <div className="flex items-center gap-[6px] text-txt-4 uppercase font-[var(--font-mono)] text-[9.5px] tracking-[0.1em] mb-[4px]">
          {agent.taskKind === "tool" && <Icon name="hammer" size={10} className={isLive ? "text-[var(--working)]" : ""} />}
          {agent.taskKind === "think" && <Icon name="cpu" size={10} className={isLive ? "text-[var(--working)]" : ""} />}
          {stateLabel}
        </div>
        <div className={cn(
          "text-txt font-[var(--font-mono)] text-[12.5px] leading-[1.5]",
          !agent.task && "text-txt-3",
        )}>
          {stateText}
          {agent.status === "thinking" && (
            <span className="typing inline-flex gap-[2px] align-[-1px] ml-[4px]"><span /><span /><span /></span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-[10px] border-t border-line pt-[10px] mt-auto">
        <span className="inline-flex items-center gap-[5px] bg-bg-3 border border-line text-txt-2 px-[6px] pr-[8px] py-[3px] rounded-[6px] font-[var(--font-mono)] text-[10.5px]">
          <span className="rounded-full w-[4px] h-[4px]" style={{ background: modelColor }} />
          {agent.defaultModel ?? "default"}
        </span>
        <span className="inline-flex items-center gap-[5px] bg-bg-3 border border-line text-txt-2 px-[6px] pr-[8px] py-[3px] rounded-[6px] font-[var(--font-mono)] text-[10.5px]">
          {agent.defaultEffort ?? "default"}
        </span>
        <span className="ml-auto font-[var(--font-mono)] text-[10.5px] text-txt-4">
          {isLive ? "now" : "idle"}
        </span>
      </div>

      <div className="of-card-actions absolute flex gap-[3px] border opacity-0 top-[12px] right-[12px] p-[3px] bg-[var(--bg-elev)] border-line-2 rounded-[8px] [box-shadow:var(--shadow-2)] [transform:translateY(-2px)] transition-[opacity,transform] duration-[140ms] z-[2] group-hover:opacity-100 group-hover:[transform:translateY(0)]">
        <button
          type="button"
          className="bg-acc inline-flex items-center font-semibold text-[var(--acc-ink)] px-[10px] py-0 h-[26px] gap-[4px] text-[11.5px] rounded-[5px] hover:bg-[var(--acc-hover)] hover:text-[var(--acc-ink)]"
          onClick={e => { e.stopPropagation(); onSelect(agent.id); }}
        >
          <Icon name="send" size={11} /> Chat
        </button>
        <button
          type="button"
          className={cn("grid place-items-center text-txt-3 w-[26px] h-[26px] rounded-[5px] hover:bg-bg-3 hover:text-txt", pinned && "text-acc bg-acc-faint")}
          title={pinned ? "Unpin" : "Pin to top"}
          onClick={e => { e.stopPropagation(); onPin(agent.id); }}
        >
          <Icon name="pin" size={12} />
        </button>
        <button
          type="button"
          className="grid place-items-center text-txt-3 w-[26px] h-[26px] rounded-[5px] hover:bg-bg-3 hover:text-txt"
          title="Settings"
          onClick={e => { e.stopPropagation(); router.push(PAGE_ROUTES.agentEdit(agent.id)); }}
        >
          <Icon name="edit" size={13} />
        </button>
      </div>
    </div>
  );
}
