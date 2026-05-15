"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useCreateProject, useProjects } from "@/modules/projects/hooks/use-projects";
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

function projectGradient(id: string): string {
  const colors = [
    ["#d63a14","#b1280c"], ["#5a8b6f","#2f5a3e"], ["#2A6FDB","#1b4fa8"],
    ["#c792ea","#7a4fa8"], ["#e6b35a","#a87a20"], ["#4eb96f","#2a7a40"],
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  const [a, b] = colors[hash % colors.length]!;
  return `linear-gradient(135deg, ${a}, ${b})`;
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

  const createProject = useCreateProject();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
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
    if (!open) {
      setCreating(false);
      setNewName("");
      return;
    }
    setActiveIndex(0);
  }, [open]);

  const navigate = (href: string, projectId: string | null) => {
    setActiveId(projectId);
    setOpen(false);
    setCreating(false);
    setNewName("");
    router.push(href);
  };

  const openCreate = () => {
    setCreating(true);
    setNewName("");
  };

  const cancelCreate = () => {
    setCreating(false);
    setNewName("");
  };

  const submitCreate = async () => {
    const name = newName.trim();
    const project = await createProject.mutateAsync(name ? { name } : {});
    navigate(PAGE_ROUTES.project(project.id), project.id);
  };

  useEffect(() => {
    if (creating) nameInputRef.current?.focus();
  }, [creating]);

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
        className="ps-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={t("project_switcher.switch_title")}
        onClick={() => setOpen((v) => !v)}
      >
        {currentId ? (
          <span className="ps-trigger-av" style={{ background: projectGradient(currentId) }}>
            {triggerLabel.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <Icon name="folder" size={13} />
        )}
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
          className="ps-menu"
        >
          <div style={{ padding: 4 }}>
            <ProjectRow
              href={PAGE_ROUTES.projects}
              primary={t("project_switcher.all_projects")}
              secondary={t("project_switcher.all_projects_subtitle")}
              italic
              selected={currentId == null}
              highlighted={activeIndex === 0}
              projectId={null}
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
                    projectId={p.id}
                    onHover={() => setActiveIndex(rowIndex)}
                    onSelect={() => navigate(PAGE_ROUTES.project(p.id), p.id)}
                  />
                );
              })
            )}

            <Separator />
          </div>

          {creating ? (
            <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("project_switcher.new_project_placeholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submitCreate(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelCreate(); }
                }}
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  fontSize: 13,
                  background: "var(--bg-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  color: "var(--txt)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  disabled={createProject.isPending}
                  onClick={submitCreate}
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    fontSize: 12,
                    background: "var(--acc)",
                    color: "var(--acc-fg, #fff)",
                    border: 0,
                    borderRadius: 4,
                    cursor: createProject.isPending ? "default" : "pointer",
                    fontFamily: "inherit",
                    opacity: createProject.isPending ? 0.6 : 1,
                  }}
                >
                  {createProject.isPending
                    ? t("project_switcher.new_project_creating")
                    : t("project_switcher.new_project_create")}
                </button>
                <button
                  type="button"
                  onClick={cancelCreate}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    background: "transparent",
                    color: "var(--txt-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t("project_switcher.new_project_cancel")}
                </button>
              </div>
              {createProject.isError ? (
                <div style={{ fontSize: 11, color: "var(--error)" }}>
                  {createProject.error instanceof Error
                    ? createProject.error.message
                    : String(createProject.error)}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="ps-foot">
              <button
                type="button"
                role="menuitem"
                onClick={openCreate}
              >
                <Icon name="plus" size={13} /> {t("project_switcher.new_project")}
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseEnter={() => setActiveIndex(rows.length - 1)}
                onClick={() => navigate(PAGE_ROUTES.projects, currentId)}
              >
                <Icon name="settings" size={13} /> {t("project_switcher.manage")}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Separator() {
  return <div className="ps-sep" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="ps-section-label">
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
  projectId?: string | null;
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
  projectId,
}: RowProps) {
  return (
    <Link
      href={href}
      role="menuitem"
      onMouseEnter={onHover}
      onClick={e => { e.preventDefault(); onSelect(); }}
      className={`ps-item${selected ? " active" : ""}${highlighted ? " highlighted" : ""}`}
    >
      {projectId ? (
        <span className="ps-item-av" style={{ background: projectGradient(projectId) }}>
          {primary.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <span className="ps-item-av" style={{ background: "var(--bg-3)" }}>
          <Icon name="folder" size={13} style={{ color: "var(--txt-3)" }} />
        </span>
      )}
      <span style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: projectId ? 600 : 500, fontStyle: italic ? "italic" : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          {primary}
          {selected && <Icon name="check" size={11} style={{ color: "var(--acc)", flexShrink: 0 }} />}
        </div>
        {secondary && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--txt-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {secondary}
          </div>
        )}
      </span>
      {healthDot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: healthDot === "working" ? "var(--working)" : "var(--error)", boxShadow: healthDot === "working" ? "0 0 5px var(--working)" : "none" }} />
      )}
    </Link>
  );
}
