"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { NavItem } from "./nav-item";
import { PixelSprite } from "@/components/ui/pixel-sprite";
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
      `Remove ${row.displayName} from ${project?.meta.name ?? "this project"}? ` +
      `Their conversation stays archived so you can still read it.`,
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
          <div className="brand-sub">studio · v3.0</div>
        </div>
      </div>

      <nav className="nav" aria-label="Primary">
        <NavItem
          href={PAGE_ROUTES.office}
          icon="home"
          label={t("nav.office")}
          badge={workingCount > 0 ? `${workingCount} live` : undefined}
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
          <span>Roster · {rosterRows.length}</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter roster"
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
              No agents in {project.meta.name}. Click <strong>Add agent</strong> on the
              office toolbar.
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
              No agent definitions yet. Drop a markdown file in{" "}
              <code>~/.claude/agents/</code>.
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
              No matches for “{filter}”.
            </div>
          ) : null}
        </div>
      </div>

      <SidebarFoot spendToday={spendToday} />
    </aside>
  );
}

function SidebarFoot({ spendToday }: { spendToday: number }) {
  return (
    <Link
      href={PAGE_ROUTES.settings}
      className="sidebar-foot"
      aria-label="Open settings"
      style={{ textDecoration: "none", color: "var(--txt)" }}
    >
      <div className="me" aria-hidden>
        P
      </div>
      <div>
        <div className="me-name">Local</div>
        <div className="me-sub">single-user</div>
      </div>
      <div className="foot-spend" aria-label={`Spend today $${spendToday.toFixed(2)}`}>
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
  const { agent, displayName } = row;
  return (
    <div
      className={"roster-row" + (selected ? " on" : "")}
      style={{ position: "relative" }}
    >
      <button
        type="button"
        onClick={onSelect}
        title="Click to view details · open chat from there"
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
          <PixelSprite
            agent={agent}
            size={32}
            animate={false}
            action={agent.status === "working" ? "typing" : "idle"}
          />
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
              ? "ready"
              : agent.status === "done"
                ? "✓ " + (agent.taskKind || "done")
                : agent.status === "queued"
                  ? "in queue"
                  : agent.status === "error"
                    ? "needs attention"
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
          aria-label={`Remove ${displayName} from this project`}
          title="Remove from project"
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
  const openLimits = useClaudeLimitsStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => openLimits(true)}
      className="nav-item"
      aria-label="Claude limits and usage"
      style={{
        font: "inherit",
        width: "100%",
        cursor: "pointer",
      }}
    >
      <Icon name="gauge" />
      <span>Limits</span>
      <span className="badge">${spendToday.toFixed(2)}</span>
    </button>
  );
}
