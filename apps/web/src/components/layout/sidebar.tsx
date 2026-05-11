"use client";

import { useMemo, useState } from "react";
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
import { useProject } from "@/modules/projects/hooks/use-projects";

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { agents, workingCount, spendToday } = useOfficeAgents();
  const selectedId = useOfficeStore((s) => s.selectedId);
  const select = useOfficeStore((s) => s.select);

  const activeProjectId = useActiveProjectStore((s) => s.id);
  const projectQ = useProject(activeProjectId);
  const project = projectQ.data;

  const rosterAgents = useMemo<OfficeAgent[]>(() => {
    if (!project) return agents;
    const rosterIds = new Set(project.meta.roster.map((i) => i.agentId));
    return agents.filter((a) => rosterIds.has(a.id));
  }, [agents, project]);

  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rosterAgents;
    return rosterAgents.filter((a) => {
      if (a.name.toLowerCase().includes(q)) return true;
      if (a.short.toLowerCase().includes(q)) return true;
      if (a.skills?.some((s) => s.toLowerCase().includes(q))) return true;
      if (a.task?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rosterAgents, filter]);

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
          <span>Roster · {rosterAgents.length}</span>
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
          {project && rosterAgents.length === 0 ? (
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
          ) : !project && rosterAgents.length === 0 ? (
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
            filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                className={"roster-row" + (selectedId === a.id ? " on" : "")}
                onClick={() => select(a.id)}
                title="Click to view details · open chat from there"
                style={{
                  background: "transparent",
                  border: "none",
                  font: "inherit",
                  color: "inherit",
                  textAlign: "left",
                }}
              >
                <div className="av">
                  <PixelSprite
                    agent={a}
                    size={32}
                    animate={false}
                    action={a.status === "working" ? "typing" : "idle"}
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
                    {a.name}
                  </div>
                  <div
                    className="ml"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.status === "idle"
                      ? "ready"
                      : a.status === "done"
                        ? "✓ " + (a.taskKind || "done")
                        : a.status === "queued"
                          ? "in queue"
                          : a.status === "error"
                            ? "needs attention"
                            : a.task ?? a.status}
                  </div>
                </div>
                <span className={"st " + a.status} title={a.status} />
              </button>
            ))
          )}
          {filtered.length === 0 && rosterAgents.length > 0 ? (
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
