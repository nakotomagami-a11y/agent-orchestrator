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
import { useProject, useRemoveInstance } from "@/modules/projects/hooks/use-projects";
import { useAgentFilter } from "@/modules/agents/hooks/use-agent-filter";
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

  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rosterRows;
    return rosterRows.filter((r) => {
      if (r.displayName.toLowerCase().includes(q)) return true;
      if (r.agent.short.toLowerCase().includes(q)) return true;
      if (r.agent.skills?.some((s) => s.toLowerCase().includes(q))) return true;
      if (r.agent.task?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rosterRows, filter]);

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
      <div className="brand">
        <div className="brand-logo" aria-hidden>
          A
        </div>
        <div>
          <div className="brand-name">{t("app.name")}</div>
          <div className="brand-sub">{t("app.brand_sub")}</div>
        </div>
      </div>

      <nav className="nav" aria-label={t("nav.primary_label")}>
        <NavItem
          href={PAGE_ROUTES.office}
          icon="home"
          label={t("nav.office")}
          badge={workingCount > 0 ? t("nav.live_badge", { count: workingCount }) : undefined}
          active={isActiveRoute(pathname, PAGE_ROUTES.office, { exact: true })}
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
      </nav>

      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
        <div className="section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{t("sidebar.roster_label", { count: rosterRows.length })}</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("common.search_placeholder")}
            aria-label={t("sidebar.filter_aria")}
            style={{
              marginLeft: "auto",
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "3px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--txt)",
              width: 110,
              outline: "none",
            }}
          />
        </div>
        <div className="roster-list">
          {project && rosterRows.length === 0 ? (
            <div
              style={{
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--txt-3)",
                lineHeight: 1.4,
              }}
            >
              {t("sidebar.no_agents_in_project", { project: project.meta.name })}
            </div>
          ) : !project && rosterRows.length === 0 ? (
            <div
              style={{
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--txt-3)",
                lineHeight: 1.4,
              }}
            >
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
            <div style={{ padding: "8px 14px", fontSize: 11, color: "var(--txt-3)" }}>
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
      className="sidebar-foot"
      aria-label={t("common.open_settings")}
      style={{ textDecoration: "none", color: "var(--txt)" }}
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
      className={"roster-row" + (selected ? " on" : "")}
      style={{ position: "relative", cursor: "grab" }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={t("sidebar.row_open_chat_title")}
    >
      <button
        type="button"
        onClick={onSelect}
        title={t("sidebar.row_open_chat_title")}
        style={{
          // Span the parent `.roster-row` grid so name + status get
          // room instead of being squashed into the 32px avatar slot.
          gridColumn: "1 / -1",
          // Reset the button's own visual chrome, then build a 3-col
          // grid inside that mirrors the original layout.
          background: "transparent",
          border: "none",
          color: "inherit",
          font: "inherit",
          padding: 0,
          margin: 0,
          textAlign: "left",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "32px 1fr auto",
          alignItems: "center",
          gap: 10,
          width: "100%",
          minWidth: 0,
        }}
      >
        <div className="av">
          <AgentAvatar unit={agent.unitChoice} size={32} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="nm"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </div>
          <div
            className="ml"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
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
          className="roster-row-remove"
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            width: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--txt-3)",
            cursor: "pointer",
            opacity: 0,
            transition: "opacity 120ms",
          }}
        >
          <Icon name="x" size={11} />
        </button>
      ) : null}
    </div>
  );
}

function LimitsNavButton({ spendToday }: { spendToday: number }) {
  const t = useTranslations();
  const openLimits = useClaudeLimitsStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => openLimits(true)}
      className="nav-item"
      aria-label={t("sidebar.limits_aria")}
      style={{
        font: "inherit",
        width: "100%",
        cursor: "pointer",
      }}
    >
      <Icon name="gauge" />
      <span>{t("nav.limits")}</span>
      <span className="badge">${spendToday.toFixed(2)}</span>
    </button>
  );
}
