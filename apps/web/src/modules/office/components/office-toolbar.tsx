"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject } from "@/modules/projects/hooks/use-projects";
import { AddAgentModal } from "@/modules/projects/components/add-agent-modal";
import type { OfficeView } from "../hooks/use-office-store";

export type OfficeToolbarProps = {
  view: OfficeView;
  setView: (next: OfficeView) => void;
  agentCount: number;
  workingCount: number;
};

export function OfficeToolbar({ view, setView, agentCount, workingCount }: OfficeToolbarProps) {
  const t = useTranslations();
  const activeProjectId = useActiveProjectStore((s) => s.id);
  const setActiveId = useActiveProjectStore((s) => s.setId);
  const projectQ = useProject(activeProjectId);
  const project = projectQ.data;

  const [addOpen, setAddOpen] = useState(false);

  const rosterCount = activeProjectId ? project?.meta.roster.length ?? 0 : 0;

  return (
    <div className="toolbar">
      <h1>{t("office.title")}</h1>
      <span className="sub">
        {activeProjectId ? (
          <>
            · {t("office.agents_count", { count: rosterCount })}
            {project ? ` ${t("office_toolbar.in_project_label", { project: project.meta.name })}` : ""}
            {" · "}
            {t("office.working_count", { count: workingCount })}
          </>
        ) : (
          <>
            · {t("office_toolbar.no_project_selected")}
            {agentCount > 0 ? ` · ${t("office_toolbar.agents_available", { count: agentCount })}` : ""}
          </>
        )}
      </span>
      <div className="right">
        <div
          role="group"
          aria-label={t("office_toolbar.view_group_aria")}
          style={{
            display: "inline-flex",
            border: "1px solid var(--line-2)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--bg-1)",
          }}
        >
          <button
            type="button"
            className={cn("btn sm ghost")}
            style={{
              borderRadius: 0,
              height: 30,
              background: view === "iso" ? "var(--acc)" : "transparent",
              color: view === "iso" ? "white" : "var(--txt-2)",
              boxShadow: "none",
            }}
            aria-pressed={view === "iso"}
            onClick={() => setView("iso")}
          >
            <Icon name="map" /> {t("office.view_iso")}
          </button>
          <button
            type="button"
            className={cn("btn sm ghost")}
            style={{
              borderRadius: 0,
              height: 30,
              background: view === "cards" ? "var(--acc)" : "transparent",
              color: view === "cards" ? "white" : "var(--txt-2)",
              boxShadow: "none",
            }}
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <Icon name="grid" /> {t("office.view_cards")}
          </button>
        </div>
        <button
          type="button"
          className="btn sm primary"
          title={
            activeProjectId
              ? t("office_toolbar.add_to_project_title", { project: project?.meta.name ?? activeProjectId })
              : t("office_toolbar.add_no_project_title")
          }
          onClick={() => setAddOpen(true)}
        >
          <Icon name="plus" /> {t("office.add_agent")}
        </button>
      </div>

      <AddAgentModal
        open={addOpen}
        projectId={activeProjectId}
        onClose={() => setAddOpen(false)}
        onProjectChange={(id) => setActiveId(id)}
      />
    </div>
  );
}
