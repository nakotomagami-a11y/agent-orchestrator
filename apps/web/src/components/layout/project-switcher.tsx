"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useProjects } from "@/modules/projects/hooks/use-projects";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import {
  useActiveProjectHydration,
  useActiveProjectStore,
} from "@/lib/active-project-store";

function currentProjectIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

export function ProjectSwitcher() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading } = useProjects();
  const projects = useMemo(() => data ?? [], [data]);
  const { data: runs } = useRuns({ limit: 50 });

  useActiveProjectHydration();
  const activeId = useActiveProjectStore((s) => s.id);
  const setActiveId = useActiveProjectStore((s) => s.setId);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const pathProjectId = currentProjectIdFromPath(pathname);

  useEffect(() => {
    if (pathProjectId && pathProjectId !== activeId) {
      setActiveId(pathProjectId);
    }
  }, [pathProjectId, activeId, setActiveId]);

  const currentId = activeId;
  const current = currentId ? projects.find((p) => p.id === currentId) ?? null : null;
  const triggerLabel = current?.name ?? (currentId ? currentId : t("project_switcher.all_projects"));

  // rows: index 0 = "All projects", 1..N = each project, N+1 = "Manage projects…"
  const rows = useMemo(() => {
    const list: Array<{
      key: string;
      href: string;
      projectId: string | null;
      type: "all" | "project" | "manage";
    }> = [{ key: "__all", href: PAGE_ROUTES.projects, projectId: null, type: "all" }];
    for (const p of projects) {
      list.push({
        key: p.id,
        href: PAGE_ROUTES.project(p.id),
        projectId: p.id,
        type: "project",
      });
    }
    list.push({ key: "__manage", href: PAGE_ROUTES.projects, projectId: null, type: "manage" });
    return list;
  }, [projects]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouse);
    return () => document.removeEventListener("mousedown", onMouse);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open]);

  const navigate = (href: string, projectId: string | null) => {
    setActiveId(projectId);
    setOpen(false);
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) navigate(row.href, row.projectId);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        className="tb-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={t("project_switcher.switch_title")}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="folder" size={13} />
        <span
          style={{
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {triggerLabel}
        </span>
        <Icon name="chevron-down" size={11} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t("project_switcher.menu_label")}
          onKeyDown={onKey}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: 260,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-2)",
            padding: 4,
            zIndex: 50,
          }}
        >
          <ProjectRow
            href={PAGE_ROUTES.projects}
            primary={t("project_switcher.all_projects")}
            secondary={t("project_switcher.all_projects_subtitle")}
            italic
            selected={currentId == null}
            highlighted={activeIndex === 0}
            onHover={() => setActiveIndex(0)}
            onSelect={() => navigate(PAGE_ROUTES.projects, null)}
          />

          <Separator />
          <SectionLabel>
            {isLoading
              ? t("project_switcher.section_loading")
              : t("project_switcher.section_count", { count: projects.length })}
          </SectionLabel>

          {!isLoading && projects.length === 0 ? (
            <div
              style={{
                padding: "8px 10px 10px",
                fontSize: 12,
                color: "var(--txt-3)",
                fontStyle: "italic",
              }}
            >
              {t("project_switcher.no_projects")}
            </div>
          ) : (
            projects.map((p, i) => {
              const rowIndex = i + 1;
              const isCurrent = p.id === currentId;
              const sub = [
                t("project_switcher.agent_count", { count: p.instanceCount }),
                p.cwd ? t("project_switcher.cwd_label", { path: p.cwd }) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const projectRuns = (runs ?? []).filter((r) => r.projectId === p.id);
              const fiveMinAgo = Date.now() - 5 * 60 * 1000;
              const hasRunning = projectRuns.some((r) => r.status === "running");
              const hasRecentError = projectRuns.some(
                (r) => r.status === "error" && r.ts > fiveMinAgo,
              );
              const healthDot: "working" | "error" | undefined = hasRunning
                ? "working"
                : hasRecentError
                  ? "error"
                  : undefined;
              return (
                <ProjectRow
                  key={p.id}
                  href={PAGE_ROUTES.project(p.id)}
                  primary={p.name}
                  secondary={sub}
                  selected={isCurrent}
                  highlighted={activeIndex === rowIndex}
                  healthDot={healthDot}
                  onHover={() => setActiveIndex(rowIndex)}
                  onSelect={() => navigate(PAGE_ROUTES.project(p.id), p.id)}
                />
              );
            })
          )}

          <Separator />
          <button
            type="button"
            role="menuitem"
            onMouseEnter={() => setActiveIndex(rows.length - 1)}
            onClick={() => navigate(PAGE_ROUTES.projects, currentId)}
            className={activeIndex === rows.length - 1 ? "nav-item on" : "nav-item"}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              fontSize: 13,
              background: activeIndex === rows.length - 1 ? "var(--bg-2)" : "transparent",
              border: 0,
              borderRadius: 4,
              color: "var(--txt)",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Icon name="settings" size={13} /> {t("project_switcher.manage")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Separator() {
  return <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "6px 10px 4px",
        fontSize: 10,
        color: "var(--txt-3)",
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </div>
  );
}

type RowProps = {
  href: string;
  primary: string;
  secondary?: string;
  italic?: boolean;
  selected: boolean;
  highlighted: boolean;
  healthDot?: "working" | "error";
  onHover: () => void;
  onSelect: () => void;
};

function ProjectRow({
  href,
  primary,
  secondary,
  italic,
  selected,
  highlighted,
  healthDot,
  onHover,
  onSelect,
}: RowProps) {
  return (
    <Link
      href={href}
      role="menuitem"
      onMouseEnter={onHover}
      onClick={(e) => {
        e.preventDefault();
        onSelect();
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr auto",
        gap: 10,
        alignItems: "center",
        width: "100%",
        padding: "6px 10px",
        background: highlighted
          ? "var(--bg-2)"
          : selected
            ? "var(--acc-faint)"
            : "transparent",
        borderRadius: 4,
        color: "var(--txt)",
        textDecoration: "none",
      }}
    >
      <span aria-hidden style={{ color: "var(--acc)", display: "inline-flex" }}>
        {selected ? "✓" : ""}
      </span>
      <span style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontStyle: italic ? "italic" : undefined,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {primary}
        </div>
        {secondary ? (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--txt-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {secondary}
          </div>
        ) : null}
      </span>
      {healthDot ? (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: healthDot === "working" ? "var(--working)" : "var(--error)",
          }}
        />
      ) : (
        <span style={{ width: 6 }} />
      )}
    </Link>
  );
}
