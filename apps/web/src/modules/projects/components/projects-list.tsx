"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModalShell } from "@/components/ui/modal-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useProjects, useCreateProject } from "../hooks/use-projects";
import type { ProjectSummary } from "@agent-office/shared/types";

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setName(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createProject.mutateAsync({ name: name.trim() });
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="New project"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-4 py-[7px] rounded-[8px] text-[13px] font-medium text-txt-2 bg-transparent border border-line hover:bg-bg-3 hover:text-txt transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-project-form"
            disabled={!name.trim() || createProject.isPending}
            className="inline-flex items-center gap-[6px] px-4 py-[7px] rounded-[8px] text-[13px] font-semibold text-white bg-acc hover:bg-[var(--acc-hover)] disabled:opacity-40 transition-colors border-none cursor-pointer"
          >
            {createProject.isPending ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={(e) => { void handleSubmit(e); }}>
        <label className="block text-[12px] text-txt-3 font-[var(--font-mono)] mb-[8px]">
          Project name
        </label>
        <div className="relative">
          <Icon
            name="folder"
            size={17}
            className="absolute left-[12px] top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none"
          />
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-project"
            className="w-full bg-[rgba(255,255,255,0.04)] rounded-[10px] pl-[38px] pr-[12px] py-[11px] text-[14px] text-txt outline-none border-0
              hover:bg-[rgba(255,255,255,0.07)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]
              focus:bg-[rgba(255,255,255,0.07)] focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]
              transition-[background,box-shadow] duration-150
              placeholder:text-[rgba(255,255,255,0.22)]"
          />
        </div>
      </form>
    </ModalShell>
  );
}

function shortenCwd(cwd: string): { prefix: string } {
  // Replace /home/<user>/ with ~/
  const tilde = cwd.replace(/^\/home\/[^/]+\//, "~/");
  const slash = tilde.lastIndexOf("/");
  return { prefix: slash > 0 ? tilde.slice(0, slash + 1) : tilde };
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function AgentChip({ count, href }: { count: number; href: string }) {
  const hasAgents = count > 0;
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={[
        "inline-flex items-center gap-1 px-[7px] py-[3px] rounded-full text-[11px] font-semibold font-[var(--font-mono)] no-underline transition-colors shrink-0",
        hasAgents
          ? "bg-[var(--ao-accent-softer,rgba(255,120,60,0.12))] text-[var(--ao-accent)] hover:bg-[var(--ao-accent-softer,rgba(255,120,60,0.2))]"
          : "bg-[var(--ao-bg-3,rgba(255,255,255,0.05))] text-[var(--ao-fg-3)] hover:bg-[var(--ao-bg-4)]",
      ].join(" ")}
    >
      {count}
    </Link>
  );
}

function ProjectRow({ p }: { p: ProjectSummary }) {
  const isEmpty = p.instanceCount === 0;
  const cwdShort = p.cwd ? shortenCwd(p.cwd) : null;

  return (
    <Link
      href={PAGE_ROUTES.project(p.id)}
      className={[
        "group/row grid items-center gap-3 px-4 py-[9px] border-b border-line no-underline text-txt",
        "hover:bg-[var(--ao-bg-2,rgba(255,255,255,0.03))] transition-colors duration-100",
        isEmpty ? "opacity-50 hover:opacity-80" : "",
      ].join(" ")}
      style={{ gridTemplateColumns: "20px 1fr auto auto" }}
    >
      <Icon name="folder" className="shrink-0 text-[var(--ao-fg-3)]" />

      <div className="min-w-0">
        <div className={["text-[13px] font-semibold leading-snug", isEmpty ? "" : ""].join(" ")}>
          {p.name}
        </div>
        {p.description ? (
          <div className="text-[11.5px] text-txt-2 mt-[1px] truncate">{p.description}</div>
        ) : null}
        {cwdShort ? (
          <div className="font-[var(--font-mono)] text-[10.5px] text-txt-3 truncate mt-[1px]">
            <span className="opacity-60">{cwdShort.prefix}</span>
          </div>
        ) : null}
      </div>

      {p.lastRunAt ? (
        <span className="font-[var(--font-mono)] text-[10.5px] text-txt-3 shrink-0 whitespace-nowrap">
          {relativeTime(p.lastRunAt)}
        </span>
      ) : (
        <span className="font-[var(--font-mono)] text-[10.5px] text-txt-3 shrink-0 opacity-0 group-hover/row:opacity-60 transition-opacity">
          no runs
        </span>
      )}

      <div className="shrink-0 flex items-center gap-1">
        <AgentChip count={p.instanceCount} href={PAGE_ROUTES.project(p.id)} />
        {isEmpty && (
          <Link
            href={PAGE_ROUTES.project(p.id)}
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover/row:opacity-100 transition-opacity inline-flex items-center gap-1 px-[7px] py-[3px] rounded-full text-[11px] font-[var(--font-mono)] no-underline bg-[var(--ao-bg-3)] text-[var(--ao-fg-2)] hover:text-[var(--ao-fg-0)] hover:bg-[var(--ao-bg-4)] border border-dashed border-[var(--ao-line-1)] whitespace-nowrap"
          >
            + agent
          </Link>
        )}
      </div>
    </Link>
  );
}

export function ProjectsList() {
  const t = useTranslations();
  const { data, isLoading } = useProjects();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const allProjects = data ?? [];

  const header = (
    <PageHeader
      title="Projects"
      sub={!isLoading ? `· ${allProjects.length} found` : undefined}
      actions={
        <button
          type="button"
          className="inline-flex items-center gap-[6px] bg-acc font-semibold cursor-pointer px-[14px] py-[8px] text-white rounded-[9px] text-[13px] transition-[background] duration-[120ms] hover:bg-[var(--acc-hover)] border-none"
          onClick={() => setCreateOpen(true)}
        >
          <Icon name="plus" size={13} /> Create project
        </button>
      }
    />
  );

  const modal = <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />;

  if (isLoading) {
    return (
      <>
        {header}
        {modal}
        <div className="overflow-auto py-[18px] px-6">
          <Skeleton width="100%" height={120} />
        </div>
      </>
    );
  }

  if (allProjects.length === 0) {
    return (
      <>
        {header}
        {modal}
        <EmptyState
          icon="folder"
          title={t("projects.empty_title")}
          description={
            <>
              {t("projects.empty_description_prefix")}
              <Link href={PAGE_ROUTES.settings}>{t("projects.empty_description_link")}</Link>
              {t("projects.empty_description_suffix")}
            </>
          }
        />
      </>
    );
  }

  const filtered = q
    ? allProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.cwd?.toLowerCase().includes(q.toLowerCase()) ||
          p.description?.toLowerCase().includes(q.toLowerCase()),
      )
    : allProjects;

  // Active (has agents) first, then empty - each group sorted alphabetically
  const sorted = [...filtered].sort((a, b) => {
    if (a.instanceCount > 0 && b.instanceCount === 0) return -1;
    if (a.instanceCount === 0 && b.instanceCount > 0) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {header}
      {modal}
      <div className="overflow-auto py-[18px] px-6">
        <Card>
          {/* Search */}
          <div className="px-4 py-[10px] border-b border-line">
            <div className="flex items-center gap-[10px] px-[14px] py-[10px]
              bg-[rgba(255,255,255,0.04)] rounded-[10px]
              hover:bg-[rgba(255,255,255,0.06)]
              focus-within:bg-[rgba(255,255,255,0.07)] focus-within:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]
              transition-[background,box-shadow] duration-150 text-[var(--ao-fg-3)]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50 focus-within:opacity-70">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter projects…"
                className="flex-1 bg-transparent border-0 outline-none text-[var(--ao-fg-0)] placeholder:text-[rgba(255,255,255,0.25)] text-[13.5px]"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="w-[18px] h-[18px] rounded-full grid place-items-center bg-[rgba(255,255,255,0.1)] text-[var(--ao-fg-2)] hover:bg-[rgba(255,255,255,0.18)] hover:text-[var(--ao-fg-0)] text-[12px] leading-none transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div>
            {sorted.length === 0 ? (
              <div className="px-4 py-6 text-[13px] text-[var(--ao-fg-3)] text-center font-[var(--font-mono)]">
                no matches for &ldquo;{q}&rdquo;
              </div>
            ) : (
              sorted.map((p) => <ProjectRow key={p.id} p={p} />)
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
