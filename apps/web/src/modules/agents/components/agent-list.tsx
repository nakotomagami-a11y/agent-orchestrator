"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { Tag } from "@/components/ui/tag";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { paletteForAgent } from "@/modules/office/utils/sprite-palette";
import { useAgents } from "../hooks/use-agents";

export function AgentList() {
  const t = useTranslations();
  const { data, isLoading } = useAgents();

  if (isLoading) {
    return (
      <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton width="100%" height={64} />
        <Skeleton width="100%" height={64} />
        <Skeleton width="100%" height={64} />
      </div>
    );
  }

  const agents = data ?? [];
  if (agents.length === 0) {
    return (
      <EmptyState
        icon="users"
        title={t("common.empty")}
        description="Drop a markdown file in ~/.claude/agents/ or click 'New agent'."
      />
    );
  }

  return (
    <div className="tab-pane">
      <Card>
        <CardHeader title={t("nav.agents") ?? "Agents"} sub={`${agents.length} total`} />
        <div>
          {agents.map((a) => {
            const sprite = paletteForAgent(a.name);
            return (
              <Link
                key={a.name}
                href={PAGE_ROUTES.agent(a.name)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "var(--txt)",
                }}
              >
                <div style={{ width: 44, height: 44 }}>
                  <PixelSprite agent={sprite} size={44} animate={false} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--txt-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.description || "—"}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {a.skills.map((s) => (
                      <Tag key={s} variant="skill">
                        #{s}
                      </Tag>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--txt-3)",
                    textAlign: "right",
                  }}
                >
                  {a.defaultModel ?? "—"} · {a.defaultEffort ?? "—"}
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
