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
        title="No projects yet"
        description={
          <>
            Configure a projects root in <Link href={PAGE_ROUTES.settings}>Settings</Link> to scan
            for project folders.
          </>
        }
      />
    );
  }

  return (
    <div className="tab-pane">
      <Card>
        <CardHeader title={t("nav.projects")} sub={`${projects.length} found`} />
        <div>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={PAGE_ROUTES.project(p.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 16px",
                borderBottom: "1px solid var(--line)",
                textDecoration: "none",
                color: "var(--txt)",
              }}
            >
              <Icon name="folder" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                {p.description ? (
                  <div style={{ fontSize: 12, color: "var(--txt-2)" }}>{p.description}</div>
                ) : null}
                {p.cwd ? (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--txt-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.cwd}
                  </div>
                ) : null}
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>
                {p.instanceCount} agent{p.instanceCount === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
