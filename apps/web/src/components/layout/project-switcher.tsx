"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useCreateProject, useProjects } from "@/modules/projects/hooks/use-projects";
import { useSettings } from "@/modules/settings/hooks/use-settings";
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
  const settingsQ = useSettings();
  const projectsRoot = settingsQ.data?.projectsRoot ?? "";

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
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center cursor-pointer text-txt-2 gap-[7px] px-2 py-1 pl-[6px] rounded-[7px] text-[12.5px] transition-[background,color] duration-[120ms] hover:bg-bg-3 hover:text-txt aria-expanded:bg-bg-3 aria-expanded:text-txt"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={t("project_switcher.switch_title")}
        onClick={() => setOpen((v) => !v)}
      >
        {currentId ? (
          <span className="grid place-items-center shrink-0 text-white font-bold w-[18px] h-[18px] rounded text-[10px]" style={{ background: projectGradient(currentId) }}>
            {triggerLabel.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <Icon name="folder" size={13} />
        )}
        <span className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
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
          className="absolute flex flex-col border border-line-2 bg-bg-elev rounded-[var(--r-lg)] shadow-[var(--shadow-3)] z-50 overflow-hidden"
          style={{ top: "calc(100% + 6px)", left: 0, width: 340, maxHeight: "70vh" }}
        >
          {/* Fixed header */}
          <div className="shrink-0 p-1 pb-0">
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
          </div>

          {/* Scrollable project list */}
          <div className="overflow-y-auto flex-1 min-h-0 px-1 [scrollbar-width:thin] [scrollbar-color:var(--line-strong)_transparent]">
            {!isLoading && projects.length === 0 ? (
              <div className="px-[10px] pt-2 pb-[10px] text-xs text-txt-3 italic">
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
          </div>

          {creating ? (
            <div className="px-[10px] pb-[10px] flex flex-col gap-1.5">
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
                className="w-full px-2 py-[5px] text-[13px] bg-bg-2 border border-line rounded text-txt outline-none box-border font-[inherit]"
              />
              {projectsRoot && newName.trim() && (
                <div className="font-mono text-[10.5px] text-txt-3 truncate" title={`${projectsRoot}/${newName.trim()}`}>
                  {projectsRoot}/{newName.trim()}
                </div>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={createProject.isPending}
                  onClick={submitCreate}
                  className="flex-1 px-2 py-1 text-xs bg-acc border-0 rounded cursor-pointer text-[var(--acc-fg,#fff)] font-[inherit]"
                  style={{
                    cursor: createProject.isPending ? "default" : "pointer",
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
                  className="px-2 py-1 text-xs bg-transparent text-txt-2 border border-line rounded cursor-pointer font-[inherit]"
                >
                  {t("project_switcher.new_project_cancel")}
                </button>
              </div>
              {createProject.isError ? (
                <div className="text-[11px] text-status-error">
                  {createProject.error instanceof Error
                    ? createProject.error.message
                    : String(createProject.error)}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid border-t border-line bg-bg-2 gap-[2px] p-[6px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button
                type="button"
                role="menuitem"
                className="flex items-center gap-2 text-txt-2 py-[7px] px-[10px] rounded-[6px] text-[12.5px] hover:bg-bg-3 hover:text-txt transition-[background,color] duration-[100ms]"
                onClick={openCreate}
              >
                <Icon name="plus" size={13} /> {t("project_switcher.new_project")}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex items-center gap-2 text-txt-2 py-[7px] px-[10px] rounded-[6px] text-[12.5px] hover:bg-bg-3 hover:text-txt transition-[background,color] duration-[100ms]"
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
  return <div className="h-px bg-[var(--line)] my-1" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center uppercase text-txt-4 px-3 pt-2 pb-1 font-[var(--font-mono)] text-[10px] tracking-[0.08em] gap-[6px]">
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
      className={cn(
        "flex items-center relative cursor-pointer text-txt no-underline gap-[10px] px-[10px] py-2 rounded-[var(--r-sm)] transition-[background] duration-[100ms] hover:bg-bg-3",
        highlighted && "bg-bg-3",
        selected && "bg-acc-faint before:content-[''] before:absolute before:left-0 before:top-[6px] before:bottom-[6px] before:w-[3px] before:bg-[var(--acc)] before:rounded-[0_2px_2px_0]"
      )}
    >
      {projectId ? (
        <span className="grid place-items-center shrink-0 text-white font-bold w-[32px] h-[32px] rounded-[8px] text-[12px] border border-[rgba(255,255,255,0.08)]" style={{ background: projectGradient(projectId) }}>
          {primary.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <span className="grid place-items-center shrink-0 text-white font-bold w-[32px] h-[32px] rounded-[8px] text-[12px] border border-[rgba(255,255,255,0.08)] bg-bg-3">
          <Icon name="folder" size={13} className="text-txt-3" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <div className={`text-[13px] font-${projectId ? "semibold" : "medium"}${italic ? " italic" : ""} overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1.5`}>
          {primary}
          {selected && <Icon name="check" size={11} className="text-acc shrink-0" />}
        </div>
        {secondary && (
          <div className="font-mono text-[10.5px] text-txt-3 overflow-hidden text-ellipsis whitespace-nowrap">
            {secondary}
          </div>
        )}
      </span>
      {healthDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: healthDot === "working" ? "var(--working)" : "var(--error)",
            boxShadow: healthDot === "working" ? "0 0 5px var(--working)" : "none",
          }}
        />
      )}
    </Link>
  );
}
