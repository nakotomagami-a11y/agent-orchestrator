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
    <aside className="sidebar" aria-label={t("app.name")}>
      <nav className="nav" aria-label={t("nav.primary_label")}>
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
          href={PAGE_ROUTES.activity}
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
        <LimitsNavButton spendToday={spendToday} />
        <ProcessesNavButton />
        <CommandPaletteNavButton />
      </nav>

      <div className="sidebar-roster-section">
        <div className="section-h section-h-row">
          <span>{t("sidebar.roster_label", { count: rosterRows.length })}</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onFocus={() => setFilterFocused(true)}
            onBlur={() => setFilterFocused(false)}
            placeholder={t("common.search_placeholder")}
            aria-label={t("sidebar.filter_aria")}
            className="roster-filter"
            style={{ width: filterFocused ? 160 : 88 }}
          />
        </div>
        <div className="roster-list">
          {project && rosterRows.length === 0 ? (
            <div className="roster-empty">
              {t("sidebar.no_agents_in_project", { project: project.meta.name })}
            </div>
          ) : !project && rosterRows.length === 0 ? (
            <div className="roster-empty">
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
            <div className="roster-no-match">
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
      className="sidebar-foot sidebar-foot-link"
      aria-label={t("common.open_settings")}
    >
      <div className="me" aria-hidden>
        P
      </div>
      <div>
        <div className="me-name">{t("sidebar.me_name")}</div>
        <div className="me-sub">{t("sidebar.me_sub")}</div>
      </div>
      <div className="foot-spend" aria-label={t("common.spend_today_aria", { amount: spendToday.toFixed(2) })}>
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
      className={"roster-row roster-row-grab" + (selected ? " on" : "")}
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
        className="roster-select-btn"
      >
        <div className="av">
          <AgentAvatar unit={agent.unitChoice} size={32} />
        </div>
        <div className="roster-name-cell">
          <div className="nm roster-truncate">
            {displayName}
          </div>
          <div className="ml roster-truncate">
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
        <span className={"st " + agent.status} title={agent.status} />
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
          className="roster-row-remove roster-row-remove-btn"
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
      className="nav-item nav-item-btn"
      onClick={() => setOpen(true)}
      aria-label="Open command palette"
      style={{ color: "var(--txt-3)" }}
    >
      <Icon name="search" />
      <span className="nav-item-label">Command palette</span>
      <span className="nav-item-kbd">
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
      className="nav-item nav-item-btn"
      aria-label={t("sidebar.limits_aria")}
    >
      <Icon name="gauge" />
      <span>{t("nav.limits")}</span>
      <span className="badge">{badge}</span>
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
      className="nav-item nav-item-btn"
      aria-label={t("processes.title")}
    >
      <Icon name="server" />
      <span>{t("nav.processes")}</span>
    </button>
  );
}
