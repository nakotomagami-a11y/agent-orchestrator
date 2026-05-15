"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
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
            <Link href={PAGE_ROUTES.project(projectId!)} className="btn">
              Add agents
            </Link>
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
            <Link href={PAGE_ROUTES.projects} className="btn">
              Open projects
            </Link>
          }
        />
      );
    }

    return (
      <>
        {workingCount > 0 && filter === "all" && (
          <div className="of-quickchat">
            <div className="glyph"><Icon name="activity" size={14} /></div>
            <div className="text">
              <span className="b">{workingCount} agent{workingCount === 1 ? "" : "s"} working</span>
              {" — open one to follow along, or jump to the activity feed."}
            </div>
            <div className="actions">
              <button type="button" className="btn-mini">
                <Icon name="activity" size={12} /> Activity
              </button>
            </div>
          </div>
        )}

        {showLive && liveAgents.length > 0 && (
          <>
            <div className="of-section-head">
              <h2>
                Live <span className="pip live">{liveAgents.length} working</span>
              </h2>
              <span className="line" />
              <span className="extra">now</span>
            </div>
            <div className="of-grid">
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
            <div className="of-section-head">
              <h2>
                Idle <span className="pip">{idleAgents.length}</span>
              </h2>
              <span className="line" />
              <span className="extra">ready when you are</span>
            </div>
            <div className="of-grid">
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
          <div className="of-empty">
            <div className="glyph"><Icon name="activity" size={22} /></div>
            <div>No agents are working right now.</div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="of-page">
      <header className="of-head">
        <div className="titles">
          <h1>
            The office
            <span className="kicker">
              {projectId ? (
                <>
                  · <span className="b">{rosterCount} agent{rosterCount === 1 ? "" : "s"}</span>
                  {projectName ? <> in {projectName}</> : null}
                  {" · "}
                  <span className="b" style={workingCount > 0 ? { color: "var(--working)" } : undefined}>
                    {workingCount} working
                  </span>
                </>
              ) : (
                <> · {agents.length} agent{agents.length === 1 ? "" : "s"}</>
              )}
            </span>
          </h1>
        </div>

        <div className="filter-pills">
          <button
            type="button"
            className={cn("of-pill", filter === "all" && "active")}
            onClick={() => setFilter("all")}
          >
            All <span className="count">{agents.length}</span>
          </button>
          <button
            type="button"
            className={cn("of-pill", filter === "live" && "active")}
            onClick={() => setFilter("live")}
          >
            <span className="led live" />
            live <span className="count">{liveAgents.length}</span>
          </button>
          <button
            type="button"
            className={cn("of-pill", filter === "idle" && "active")}
            onClick={() => setFilter("idle")}
          >
            <span className="led idle" />
            idle <span className="count">{idleAgents.length}</span>
          </button>
        </div>

        <div className="right">
          {projectId && <DevServerButton projectId={projectId} />}
          <div className="view-seg">
            <button
              type="button"
              className={cn(view === "iso" && "active")}
              onClick={() => setView("iso")}
            >
              <Icon name="map" size={12} /> Iso
            </button>
            <button
              type="button"
              className={cn(view === "cards" && "active")}
              onClick={() => setView("cards")}
            >
              <Icon name="grid" size={12} /> Cards
            </button>
          </div>
          <button type="button" className="add" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={13} /> Add agent
          </button>
        </div>
      </header>

      <div className="of-body">
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
    <div className="of-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="of-card opacity-50">
          <div className="head-row">
            <div className="av bg-bg-3" />
            <div className="name-blk">
              <div className="h-[14px] w-[60%] bg-bg-3 rounded mb-[6px]" />
              <div className="h-[10px] w-[40%] bg-bg-3 rounded" />
            </div>
          </div>
          <div className="state-box">
            <div className="h-[10px] w-[30%] bg-bg-3 rounded mb-[6px]" />
            <div className="h-3 w-[80%] bg-bg-3 rounded" />
          </div>
          <div className="foot-row">
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
  const isLive = agent.status === "working" || agent.status === "thinking";
  const isError = agent.status === "error";

  const stateLabel =
    agent.taskKind === "tool" ? "doing now" :
    agent.taskKind === "think" ? "thinking" :
    "status";

  const stateText = agent.task ?? "Idle — ready when you are";

  const modelColor =
    (agent.defaultModel ?? "").includes("haiku") ? "var(--done)" :
    (agent.defaultModel ?? "").includes("opus") ? "#ffcb6b" :
    "#c792ea";

  const chipClass = cn(
    "status-chip",
    agent.status === "working" && "live",
    agent.status === "thinking" && "busy",
    isError && "error",
  );

  const statusText =
    agent.status === "working" ? "running" :
    agent.status === "thinking" ? "thinking" :
    agent.status === "error" ? "error" :
    "idle";

  const dotClass = cn(
    "stat-dot",
    agent.status === "working" && "live",
    agent.status === "thinking" && "busy",
    isError && "error",
    !isLive && !isError && "idle",
  );

  return (
    <div
      className={cn("of-card", isLive && "live", isError && "error", selected && "selected", pinned && "pinned")}
      onClick={() => onSelect(agent.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(agent.id)}
    >
      <div className="head-row">
        <div className="av">
          <AgentAvatar unit={agent.unitChoice} size={42} />
          <span className={dotClass} />
        </div>
        <div className="name-blk">
          <div className="name">
            {pinned && <Icon name="pin" size={11} className="text-acc shrink-0" />}
            {agent.name}
          </div>
          <div className="slug">{agent.id}</div>
        </div>
        <span className={chipClass}>
          <span className="led" />
          {statusText}
        </span>
      </div>

      <div className="state-box">
        <div className="label">
          {agent.taskKind === "tool" && <Icon name="hammer" size={10} className="glyph" />}
          {agent.taskKind === "think" && <Icon name="cpu" size={10} className="glyph" />}
          {stateLabel}
        </div>
        <div className={cn("text", !agent.task && "muted")}>
          {stateText}
          {agent.status === "thinking" && (
            <span className="typing"><span /><span /><span /></span>
          )}
        </div>
      </div>

      <div className="foot-row">
        <span className="meta-pill">
          <span className="d" style={{ background: modelColor }} />
          {agent.defaultModel ?? "default"}
        </span>
        <span className="meta-pill">{agent.defaultEffort ?? "default"}</span>
        <span className="last">{isLive ? "now" : "idle"}</span>
      </div>

      <div className="of-card-actions">
        <button
          type="button"
          className="primary"
          onClick={e => { e.stopPropagation(); onSelect(agent.id); }}
        >
          <Icon name="send" size={11} /> Chat
        </button>
        <button
          type="button"
          className={cn(pinned && "pinned")}
          title={pinned ? "Unpin" : "Pin to top"}
          onClick={e => { e.stopPropagation(); onPin(agent.id); }}
        >
          <Icon name="pin" size={12} />
        </button>
        <button
          type="button"
          title="Settings"
          onClick={e => e.stopPropagation()}
        >
          <Icon name="edit" size={13} />
        </button>
      </div>
    </div>
  );
}
