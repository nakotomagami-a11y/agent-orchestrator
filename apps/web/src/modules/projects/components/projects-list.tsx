"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { ACCENT_BTN } from "@/lib/button-styles";
import { cn } from "@/lib/cn";
import { PlanetCanvas } from "@/components/ui/planet-canvas";
import { PAGE_ROUTES } from "@agent-office/domain/config/routes";
import { useProjects } from "../hooks/use-projects";
import type { ProjectSummary } from "@agent-office/domain/types";
import { BootstrapProjectModal } from "./bootstrap-project-modal";
import { relativeTime, shortenCwd } from "../format/format";

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

function ProjectRowMeta({ p, cwdShort }: { p: ProjectSummary; cwdShort: ReturnType<typeof shortenCwd> | null }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-semibold leading-snug">{p.name}</div>
      {p.description ? (
        <div className="text-[11.5px] text-txt-2 mt-[1px] truncate">{p.description}</div>
      ) : null}
      {cwdShort ? (
        <div className="font-[var(--font-mono)] text-[10.5px] text-txt-3 truncate mt-[1px]">
          <span className="opacity-60">{cwdShort.prefix}</span>
        </div>
      ) : null}
    </div>
  );
}

function ProjectRowLastRun({ lastRunAt }: { lastRunAt: number | null | undefined }) {
  if (lastRunAt) {
    return (
      <span className="font-[var(--font-mono)] text-[10.5px] text-txt-3 shrink-0 whitespace-nowrap">
        {relativeTime(lastRunAt)}
      </span>
    );
  }
  return (
    <span className="font-[var(--font-mono)] text-[10.5px] text-txt-3 shrink-0 opacity-0 group-hover/row:opacity-60 transition-opacity">
      no runs
    </span>
  );
}

function ProjectRowActions({ p, isEmpty }: { p: ProjectSummary; isEmpty: boolean }) {
  return (
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
  );
}

function ProjectRow({ p }: { p: ProjectSummary }) {
  const isEmpty = p.instanceCount === 0;
  const cwdShort = p.cwd ? shortenCwd(p.cwd) : null;

  return (
    <Link
      href={PAGE_ROUTES.project(p.id)}
      className={[
        "group/row flex items-center gap-3 px-4 py-[9px] border-b border-line no-underline text-txt",
        "hover:bg-[var(--ao-bg-2,rgba(255,255,255,0.03))] transition-colors duration-100",
        isEmpty ? "opacity-50 hover:opacity-80" : "",
      ].join(" ")}
    >
      <PlanetCanvas projectId={p.id} config={p.planet} size={20} className="shrink-0 rounded-full overflow-hidden w-[20px]" />
      <ProjectRowMeta p={p} cwdShort={cwdShort} />
      <ProjectRowLastRun lastRunAt={p.lastRunAt} />
      <ProjectRowActions p={p} isEmpty={isEmpty} />
    </Link>
  );
}

function ProjectsSearchBar({ q, onChange }: { q: string; onChange: (v: string) => void }) {
  return (
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
          onChange={(e) => onChange(e.target.value)}
          placeholder="Filter projects…"
          className="flex-1 bg-transparent border-0 outline-none text-[var(--ao-fg-0)] placeholder:text-[rgba(255,255,255,0.25)] text-[13.5px]"
        />
        {q && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.1)] text-[var(--ao-fg-2)] hover:bg-[rgba(255,255,255,0.18)] hover:text-[var(--ao-fg-0)] text-[12px] leading-none transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function filterAndSortProjects(all: ProjectSummary[], q: string): ProjectSummary[] {
  const filtered = q
    ? all.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.cwd?.toLowerCase().includes(q.toLowerCase()) ||
          p.description?.toLowerCase().includes(q.toLowerCase()),
      )
    : all;
  // Active (has agents) first, then empty — each group sorted alphabetically.
  return [...filtered].sort((a, b) => {
    if (a.instanceCount > 0 && b.instanceCount === 0) return -1;
    if (a.instanceCount === 0 && b.instanceCount > 0) return 1;
    return a.name.localeCompare(b.name);
  });
}

function ProjectsListHeader({ count, onCreate }: { count?: number; onCreate: () => void }) {
  return (
    <PageHeader
      title="Projects"
      sub={count !== undefined ? `· ${count} found` : undefined}
      actions={
        <button
          type="button"
          className={`inline-flex items-center gap-[6px] ${ACCENT_BTN} font-semibold cursor-pointer px-[14px] py-[8px] rounded-[9px] text-[13px]`}
          onClick={onCreate}
        >
          <Icon name="plus" size={13} /> Create project
        </button>
      }
    />
  );
}

function ProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations();
  return (
    <div
      role="status"
      className="flex-1 flex items-center justify-center px-6 py-[56px] page-fade-in"
    >
      <div className="flex flex-col items-center text-center max-w-[440px]">
        {/* Decorative planet cluster — a tiny procedural "solar system" that
            ties the empty state to the app's whole aesthetic. Purely
            ornamental, so hidden from assistive tech. */}
        <div aria-hidden className="relative w-[240px] h-[190px] mb-[30px] shrink-0">
          {/* Soft accent glow behind the system (gradient escape hatch). */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 44%, rgba(124,106,245,0.22) 0%, transparent 62%)" }}
          />
          {/* Main planet. */}
          <div className="absolute left-1/2 top-[42px] -translate-x-1/2 animate-[es-float-hero_6s_ease-in-out_infinite]">
            <PlanetCanvas projectId="empty-hero" config={{ type: "terran", seed: 42, paletteIdx: 0 }} size={104} />
          </div>
          {/* Small ringed gas giant, upper right. */}
          <div className="absolute right-[2px] top-[2px] animate-[es-float-a_4.6s_ease-in-out_infinite]">
            <PlanetCanvas projectId="empty-satellite-a" config={{ type: "gas-giant", seed: 128, paletteIdx: 0 }} size={44} />
          </div>
          {/* Tiny icy moon, lower left. */}
          <div className="absolute left-[16px] bottom-[6px] animate-[es-float-b_5.4s_ease-in-out_infinite]">
            <PlanetCanvas projectId="empty-satellite-b" config={{ type: "ice", seed: 5, paletteIdx: 0 }} size={26} />
          </div>
        </div>

        <h2 className="m-0 text-[21px] font-bold tracking-[-0.01em] text-txt leading-tight">
          {t("projects.empty_title")}
        </h2>
        <p className="mt-[10px] mb-0 text-[13.5px] leading-[1.55] text-txt-2">
          {t("projects.empty_body")}
        </p>

        <button
          type="button"
          onClick={onCreate}
          className={cn(
            "mt-[26px] inline-flex items-center gap-[7px] font-semibold cursor-pointer px-[18px] py-[10px] rounded-[10px] text-[13px]",
            ACCENT_BTN,
          )}
        >
          <Icon name="plus" size={14} /> {t("projects.empty_cta")}
        </button>

        <Link
          href={PAGE_ROUTES.settings}
          className="mt-[14px] inline-flex items-center gap-[6px] text-[12px] text-txt-3 hover:text-acc no-underline transition-colors"
        >
          <Icon name="folder" size={12} />
          {t("projects.empty_scan_link")}
        </Link>
      </div>
    </div>
  );
}

export function ProjectsList() {
  const { data, isLoading } = useProjects();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const allProjects = data ?? [];
  const modal = <BootstrapProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />;

  if (isLoading) {
    return (
      <>
        <ProjectsListHeader onCreate={() => setCreateOpen(true)} />
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
        <ProjectsListHeader onCreate={() => setCreateOpen(true)} />
        {modal}
        <ProjectsEmptyState onCreate={() => setCreateOpen(true)} />
      </>
    );
  }

  const sorted = filterAndSortProjects(allProjects, q);

  return (
    <>
      <ProjectsListHeader count={allProjects.length} onCreate={() => setCreateOpen(true)} />
      {modal}
      <div className="overflow-auto py-[18px] px-6">
        <Card>
          <ProjectsSearchBar q={q} onChange={setQ} />
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
