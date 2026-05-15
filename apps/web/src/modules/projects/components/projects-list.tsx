"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { useProjects } from "../hooks/use-projects";

export function ProjectsList() {
  const t = useTranslations();
  const { data, isLoading } = useProjects();

  if (isLoading) {
    return (
      <div className="tab-pane">
        <Skeleton width="100%" height={120} />
      </div>
    );
  }
  const projects = data ?? [];
  if (projects.length === 0) {
    return (
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
    );
  }

  return (
    <div className="tab-pane">
      <Card>
        <CardHeader title={t("nav.projects")} sub={t("projects.found_count", { count: projects.length })} />
        <div>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={PAGE_ROUTES.project(p.id)}
              className="grid gap-3 items-center px-4 py-[10px] border-b border-line no-underline text-txt"
              style={{ gridTemplateColumns: "auto 1fr auto" }}
            >
              <Icon name="folder" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{p.name}</div>
                {p.description ? (
                  <div className="text-[12px] text-txt-2">{p.description}</div>
                ) : null}
                {p.cwd ? (
                  <div className="font-[var(--font-mono)] text-[11px] text-txt-3 overflow-hidden text-ellipsis whitespace-nowrap">
                    {p.cwd}
                  </div>
                ) : null}
              </div>
              <span className="font-[var(--font-mono)] text-[11px] text-txt-3">
                {t("projects.instances_count", { count: p.instanceCount })}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
