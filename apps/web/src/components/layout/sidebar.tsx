"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { NavItem } from "./nav-item";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { isActiveRoute } from "./sidebar.utils";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useOfficeAgents, type OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import { useOfficeStore } from "@/modules/office/hooks/use-office-store";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useClaudeLimitsStore } from "@/lib/claude-limits-store";
import { useProcessesStore } from "@/lib/processes-store";
import { usePaletteStore } from "@/lib/palette-store";
import { useProject, useRemoveInstance } from "@/modules/projects/hooks/use-projects";
import { useFilter } from "@/hooks/use-filter";
import type { AgentInstance } from "@agent-office/shared/types";
import {
  AGENT_DRAG_MIME,
  useOfficeDragStore,
  type DragRef,
} from "@/modules/office/hooks/use-office-drag";

type RosterRow = {
  /** Stable React key. */
  key: string;
  agent: OfficeAgent;
  /** Roster instance for this row (null when there's no active project). */
  instance: AgentInstance | null;
  /** Display name. Uses instance.label if set; else agent.name; else short id. */
  displayName: string;
};

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { agents, workingCount, spendToday } = useOfficeAgents();
  const selectedId = useOfficeStore((s) => s.selectedId);
  const selectedInstanceId = useOfficeStore((s) => s.selectedInstanceId);
  const select = useOfficeStore((s) => s.select);

  const activeProjectId = useActiveProjectStore((s) => s.id);
  const projectQ = useProject(activeProjectId);
  const project = projectQ.data;
  const removeMut = useRemoveInstance();

  // When a project is active, the roster lists *instances* (one row per
  // entry in `project.meta.roster`). Two `frontend-craftsman` instances
  // become two separate rows. When no project is active, fall back to a
  // flat agent-definition list.
  const rosterRows = useMemo<RosterRow[]>(() => {
    if (!project) {
      return agents.map((a) => ({
        key: a.id,
        agent: a,
        instance: null,
        displayName: a.name,
      }));
    }
    const agentsById = new Map(agents.map((a) => [a.id, a] as const));
    const seenSameAgent = new Map<string, number>();
    const rows: RosterRow[] = [];
    for (const inst of project.meta.roster) {
      const a = agentsById.get(inst.agentId);
      if (!a) continue;
      const count = (seenSameAgent.get(inst.agentId) ?? 0) + 1;
      seenSameAgent.set(inst.agentId, count);
      const totalForAgent = project.meta.roster.filter((i) => i.agentId === inst.agentId).length;
      const displayName = inst.label
        ? inst.label
        : totalForAgent > 1
          ? `${a.name} #${count}`
          : a.name;
      rows.push({ key: inst.instanceId, agent: a, instance: inst, displayName });
    }
    return rows;
  }, [agents, project]);

  const [filterFocused, setFilterFocused] = useState(false);
  const { query: filter, setQuery: setFilter, filtered } = useFilter(
    rosterRows,
    (r, q) => {
      const lq = q.toLowerCase();
      if (r.displayName.toLowerCase().includes(lq)) return true;
      if (r.agent.short.toLowerCase().includes(lq)) return true;
      if (r.agent.skills?.some((s) => s.toLowerCase().includes(lq)) ?? false) return true;
      if (r.agent.task?.toLowerCase().includes(lq) ?? false) return true;
      return false;
    },
  );

  const onRemove = (row: RosterRow) => {
    if (!activeProjectId || !row.instance) return;
    const ok = window.confirm(
      t("sidebar.remove_confirm", {
        name: row.displayName,
        project: project?.meta.name ?? "",
      }),
    );
    if (!ok) return;
    removeMut.mutate({ projectId: activeProjectId, instanceId: row.instance.instanceId });
  };

  return (
    <aside
      className="bg-bg-2 border-r border-line grid min-h-0 overflow-hidden max-[1024px]:overflow-hidden max-[600px]:hidden"
      style={{ gridTemplateRows: "auto 1fr auto" }}
      aria-label={t("app.name")}
    >
      <nav className="p-[6px] flex flex-col gap-[2px]" aria-label={t("nav.primary_label")}>
        <NavItem
          href={PAGE_ROUTES.office}
          icon="home"
          label={t("nav.office")}
          badge={workingCount > 0 ? t("nav.live_badge", { count: workingCount }) : undefined}
          active={isActiveRoute(pathname, PAGE_ROUTES.office, { exact: true })}
        />
        <NavItem
          href={activeProjectId ? PAGE_ROUTES.project(activeProjectId) : PAGE_ROUTES.projects}
          icon="settings"
          label={t("nav.project")}
          active={isActiveRoute(pathname, PAGE_ROUTES.projects)}
        />
        <NavItem
          href={
            activeProjectId
              ? `${PAGE_ROUTES.activity}?project=${encodeURIComponent(activeProjectId)}`
              : PAGE_ROUTES.activity
          }
          icon="activity"
          label={t("nav.activity")}
          active={isActiveRoute(pathname, PAGE_ROUTES.activity)}
        />
        <NavItem
          href={PAGE_ROUTES.agents}
          icon="templates"
          label={t("nav.agents")}
          active={isActiveRoute(pathname, PAGE_ROUTES.agents)}
        />
        <NavItem
          href={PAGE_ROUTES.memory}
          icon="memory"
          label={t("nav.memory")}
          active={isActiveRoute(pathname, PAGE_ROUTES.memory)}
        />
        <LimitsNavButton spendToday={spendToday} />
        <ProcessesNavButton />
        <CommandPaletteNavButton />
      </nav>

      <div className="flex flex-col min-h-0">
        {/* Roster header */}
        <div className="flex items-center gap-[6px] px-[10px] py-[8px] border-b border-line shrink-0">
          <span className="text-[11.5px] font-semibold text-txt tracking-[0.01em] flex-1">Roster</span>
          <span className="font-[var(--font-mono)] text-[10px] bg-bg-3 border border-line text-txt-3 rounded-full px-[7px] py-[1px]">
            {rosterRows.length}
          </span>
          <button
            type="button"
            onClick={() => { setFilterFocused((v) => !v); if (filterFocused) setFilter(""); }}
            className={cn(
              "w-[24px] h-[24px] grid place-items-center rounded-[5px] transition-[background,color] duration-[120ms]",
              filterFocused || filter ? "bg-bg-3 text-acc" : "text-txt-3 hover:bg-bg-3 hover:text-txt",
            )}
            aria-label={t("sidebar.filter_aria")}
          >
            <Icon name="search" size={12} />
          </button>
        </div>

        {/* Expandable search input */}
        {(filterFocused || filter) && (
          <div className="px-[8px] py-[6px] border-b border-line shrink-0">
            <div className="flex items-center gap-[6px] bg-bg-1 border border-line rounded-[7px] px-[8px] focus-within:border-line-2">
              <Icon name="search" size={11} className="text-txt-4 shrink-0" />
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onBlur={() => { if (!filter) setFilterFocused(false); }}
                onKeyDown={(e) => { if (e.key === "Escape") { setFilter(""); setFilterFocused(false); } }}
                placeholder={t("common.search_placeholder")}
                aria-label={t("sidebar.filter_aria")}
                className="flex-1 bg-transparent border-0 outline-none text-txt text-[12px] py-[6px] font-[var(--font-mono)] placeholder:text-txt-4"
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className="w-[16px] h-[16px] grid place-items-center text-txt-4 hover:text-txt shrink-0"
                >
                  <Icon name="x" size={10} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex flex-col gap-[2px] min-h-0 pb-2 px-[6px] flex-1">
          {project && rosterRows.length === 0 ? (
            <div className="text-txt-3 px-[14px] py-3 text-[12px] leading-[1.4]">
              {t("sidebar.no_agents_in_project", { project: project.meta.name })}
            </div>
          ) : !project && rosterRows.length === 0 ? (
            <div className="text-txt-3 px-[14px] py-3 text-[12px] leading-[1.4]">
              {t("sidebar.no_agent_definitions")}
            </div>
          ) : (
            filtered.map((row) => {
              const isSelected =
                selectedId === row.agent.id &&
                (row.instance ? selectedInstanceId === row.instance.instanceId : selectedInstanceId === null);
              return (
                <RosterEntry
                  key={row.key}
                  row={row}
                  selected={isSelected}
                  canRemove={!!row.instance}
                  onSelect={() =>
                    select(row.agent.id, {
                      instanceId: row.instance?.instanceId ?? null,
                    })
                  }
                  onRemove={() => onRemove(row)}
                />
              );
            })
          )}
          {filtered.length === 0 && rosterRows.length > 0 ? (
            <div className="text-txt-3 px-[14px] py-2 text-[11px]">
              {t("common.no_matches", { query: filter })}
            </div>
          ) : null}
        </div>
      </div>

      <SidebarFoot spendToday={spendToday} />
    </aside>
  );
}

function SidebarFoot({ spendToday }: { spendToday: number }) {
  const t = useTranslations();
  return (
    <Link
      href={PAGE_ROUTES.settings}
      className="p-[10px] border-t border-line flex items-center gap-[10px] no-underline text-txt max-[1024px]:justify-center max-[1024px]:px-0 max-[1024px]:py-3"
      aria-label={t("common.open_settings")}
    >
      <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-white font-bold text-[12px] [background:linear-gradient(135deg,#77216F,#E95420)]" aria-hidden>
        P
      </div>
      <div>
        <div className="text-[12px] font-medium max-[1024px]:hidden">{t("sidebar.me_name")}</div>
        <div className="text-[10.5px] text-txt-3 font-[var(--font-mono)] max-[1024px]:hidden">{t("sidebar.me_sub")}</div>
      </div>
      <div className="ml-auto font-[var(--font-mono)] text-[11px] bg-bg-1 border border-line py-1 px-2 rounded-[999px] text-txt-2 max-[1024px]:hidden" aria-label={t("common.spend_today_aria", { amount: spendToday.toFixed(2) })}>
        ${spendToday.toFixed(2)}
      </div>
    </Link>
  );
}

function RosterEntry({
  row,
  selected,
  canRemove,
  onSelect,
  onRemove,
}: {
  row: RosterRow;
  selected: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const { agent, instance, displayName } = row;
  const setDragging = useOfficeDragStore((s) => s.setDragging);

  const dragRef: DragRef = instance
    ? { agentId: agent.id, instanceId: instance.instanceId }
    : { agentId: agent.id };

  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Stash a JSON payload so onDrop can reconstruct the ref; also push
    // a plain-text fallback for browsers that ignore custom MIME types.
    e.dataTransfer.setData(AGENT_DRAG_MIME, JSON.stringify(dragRef));
    e.dataTransfer.setData("text/plain", agent.id);
    e.dataTransfer.effectAllowed = "move";
    setDragging(dragRef);
  };

  const onDragEnd = () => setDragging(null);

  return (
    <div
      className={cn(
        "group relative cursor-grab grid items-center gap-[10px] rounded-[var(--r-sm)] cursor-pointer hover:bg-bg-3",
        selected ? "bg-acc-faint" : ""
      )}
      style={{ gridTemplateColumns: "32px 1fr auto", padding: "6px 8px" }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={t("sidebar.row_open_chat_title")}
    >
      {/* Span the parent `.roster-row` grid so name + status get
          room instead of being squashed into the 32px avatar slot.
          Reset the button's own visual chrome, then build a 3-col
          grid inside that mirrors the original layout. */}
      <button
        type="button"
        onClick={onSelect}
        title={t("sidebar.row_open_chat_title")}
        className="bg-transparent border-none text-left cursor-pointer grid items-center w-full min-w-0 col-span-full"
        style={{ color: "inherit", font: "inherit", padding: 0, margin: 0, gridTemplateColumns: "32px 1fr auto", gap: 10 }}
      >
        <div className="w-[32px] h-[32px] relative">
          <AgentAvatar unit={agent.unitChoice} size={32} />
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-txt overflow-hidden text-ellipsis whitespace-nowrap">
            {displayName}
          </div>
          <div className="text-[10.5px] text-txt-3 font-[var(--font-mono)] overflow-hidden text-ellipsis whitespace-nowrap">
            {agent.status === "idle"
              ? t("sidebar.status_ready")
              : agent.status === "done"
                ? t("sidebar.status_done", { label: agent.taskKind || t("sidebar.status_done_default") })
                : agent.status === "queued"
                  ? t("sidebar.status_queued")
                  : agent.status === "error"
                    ? t("sidebar.status_needs_attention")
                    : agent.task ?? agent.status}
          </div>
        </div>
        <span
          className={cn(
            "inline-block w-[8px] h-[8px] rounded-full",
            agent.status === "working" && "bg-[var(--working)] shadow-[0_0_0_3px_rgba(34,197,94,0.25)] animate-[pulseDot_1.8s_infinite_ease-in-out]",
            agent.status === "done" && "bg-[var(--done)]",
            agent.status === "queued" && "bg-[var(--queued)]",
            agent.status === "error" && "bg-[var(--error)]",
            agent.status === "thinking" && "bg-[var(--thinking)] animate-[pulseDot_1.8s_infinite_ease-in-out]",
            !["working","done","queued","error","thinking"].includes(agent.status) && "bg-[var(--txt-4)]",
          )}
          title={agent.status}
        />
      </button>
      {canRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={t("sidebar.remove_from_project_aria", { name: displayName })}
          title={t("sidebar.remove_from_project_title")}
          className="absolute bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 cursor-pointer opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--error)] hover:border-[var(--error)] transition-opacity duration-[120ms]"
          style={{ right: 6, top: "50%", transform: "translateY(-50%)", width: 22, height: 22 }}
        >
          <Icon name="x" size={11} />
        </button>
      ) : null}
    </div>
  );
}

function CommandPaletteNavButton() {
  const setOpen = usePaletteStore((s) => s.setOpen);
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  return (
    <button
      type="button"
      className="flex items-center gap-[10px] h-[34px] px-[10px] rounded-[var(--r-sm)] text-[13px] text-txt-3 cursor-pointer border-none bg-transparent font-[inherit] text-left no-underline hover:bg-bg-3 w-full"
      onClick={() => setOpen(true)}
      aria-label="Open command palette"
    >
      <Icon name="search" />
      <span className="flex-1 text-left">Command palette</span>
      <span className="bg-bg-2 border border-line text-txt-3 text-[10px] font-[var(--font-mono)] rounded px-[5px] py-[1px]">
        {isMac ? "⌘K" : "Ctrl+K"}
      </span>
    </button>
  );
}

function LimitsNavButton({ spendToday }: { spendToday: number }) {
  const t = useTranslations();
  const openLimits = useClaudeLimitsStore((s) => s.setOpen);
  const quotaUsd = useClaudeLimitsStore((s) => s.quotaUsd);
  const badge = quotaUsd > 0
    ? `${Math.min(100, (spendToday / quotaUsd) * 100).toFixed(0)}%`
    : `$${spendToday.toFixed(2)}`;
  return (
    <button
      type="button"
      onClick={() => openLimits(true)}
      className="flex items-center gap-[10px] h-[34px] px-[10px] rounded-[var(--r-sm)] text-[13px] text-txt-2 cursor-pointer border-none bg-transparent font-[inherit] text-left no-underline hover:bg-bg-3 w-full"
      aria-label={t("sidebar.limits_aria")}
    >
      <Icon name="gauge" />
      <span>{t("nav.limits")}</span>
      <span className="ml-auto font-[var(--font-mono)] text-[10.5px] py-[2px] px-[6px] bg-bg-3 text-txt-2 rounded-[999px]">{badge}</span>
    </button>
  );
}

function ProcessesNavButton() {
  const t = useTranslations();
  const setOpen = useProcessesStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-[10px] h-[34px] px-[10px] rounded-[var(--r-sm)] text-[13px] text-txt-2 cursor-pointer border-none bg-transparent font-[inherit] text-left no-underline hover:bg-bg-3 w-full"
      aria-label={t("processes.title")}
    >
      <Icon name="server" />
      <span>{t("nav.processes")}</span>
    </button>
  );
}
