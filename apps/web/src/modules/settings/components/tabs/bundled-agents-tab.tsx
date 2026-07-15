"use client";

/**
 * Bundled agents tab — a lightweight surface over the existing
 * `/api/starter/agent-diff` endpoint so the user can review the state of the
 * shipped default roster whenever they want, not only on first launch or when
 * the manifest version bumps.
 *
 * The heavy lifting (three-list diff, accept/skip, backup to _archive/) is
 * done by `AgentMigrationModal`; this tab is a status card plus a launcher.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@agent-office/domain/hooks/query-keys";
import { AgentMigrationModal } from "@/modules/agents/components/agent-migration-modal";
import { useAgentDiff } from "@/modules/agents/hooks/use-agent-migration";

export function BundledAgentsTab() {
  const qc = useQueryClient();
  const diffQ = useAgentDiff(true);
  const [modalOpen, setModalOpen] = useState(false);

  if (diffQ.isLoading) return <Skeleton width="100%" height={200} />;

  if (diffQ.isError) {
    return (
      <Card>
        <CardHeader
          title="Bundled agents"
          sub="Couldn't reach the manifest — the starter bundle may be missing from this build."
        />
      </Card>
    );
  }

  const diff = diffQ.data;
  if (!diff) return null;

  const {
    bundleVersion,
    installedVersion,
    newAgents,
    changed,
    onlyLocal,
  } = diff;
  const upToDate =
    bundleVersion !== null &&
    installedVersion === bundleVersion &&
    newAgents.length === 0 &&
    changed.length === 0;
  const actionable = newAgents.length + changed.length;

  return (
    <>
      <Card>
        <CardHeader
          title="Bundled agents"
          sub="Agent Office ships with a default roster. Add, refresh, or ignore each one — your customizations are always backed up before an override."
        />
        <div className="p-4 flex flex-col gap-[14px]">
          <div className="flex flex-wrap gap-[10px]">
            <VersionPill label="Bundle" value={bundleVersion ?? "—"} />
            <VersionPill
              label="Installed"
              value={installedVersion ?? "never"}
              muted={installedVersion === null}
            />
            <StatusPill upToDate={upToDate} />
          </div>

          <div className="flex flex-wrap gap-[10px]">
            <CountTile
              icon="plus"
              label="New in bundle"
              count={newAgents.length}
              tone="accent"
            />
            <CountTile
              icon="refresh"
              label="Updated in bundle"
              count={changed.length}
              tone="warning"
            />
            <CountTile
              icon="identity"
              label="Local-only (never touched)"
              count={onlyLocal.length}
              tone="neutral"
            />
          </div>

          <div className="flex items-center gap-[8px] justify-end">
            <Button
              variant="ghost"
              onClick={() =>
                qc.invalidateQueries({
                  queryKey: queryKeys.agents.migrationDiff(),
                })
              }
            >
              <Icon name="refresh" size={13} className="mr-[6px]" />
              Re-check
            </Button>
            <Button
              variant="primary"
              disabled={actionable === 0}
              onClick={() => setModalOpen(true)}
            >
              {actionable === 0
                ? "Nothing to review"
                : `Review ${actionable} change${actionable === 1 ? "" : "s"}`}
            </Button>
          </div>

          <p className="text-[12px] text-txt-3 leading-[1.55] mt-[4px]">
            The bundle lives in{" "}
            <code className="font-mono text-[11.5px] text-txt-2">
              apps/web/starter-data/agents/
            </code>
            . Agent identity — foundational knowledge that ships as part of
            who an agent is — can travel alongside as{" "}
            <code className="font-mono text-[11.5px] text-txt-2">
              &lt;name&gt;.identity.md
            </code>
            . Per-installation session memory (
            <code className="font-mono text-[11.5px] text-txt-2">
              .memory.md
            </code>
            ) is never shipped or touched by the migration flow.
          </p>
        </div>
      </Card>

      <AgentMigrationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

// ─── Presentational bits ────────────────────────────────────────────────

function VersionPill({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-[6px] h-[26px] px-[10px] rounded-[6px] border border-ao-line-1 bg-ao-bg-3 font-mono text-[11.5px]">
      <span className="text-txt-3 uppercase tracking-[0.06em] text-[10px]">
        {label}
      </span>
      <span className={muted ? "text-txt-4 italic" : "text-txt"}>{value}</span>
    </span>
  );
}

function StatusPill({ upToDate }: { upToDate: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-[6px] h-[26px] px-[10px] rounded-[6px] font-mono text-[11.5px] " +
        (upToDate
          ? "border border-[color-mix(in_oklch,var(--status-done)_35%,transparent)] bg-[color-mix(in_oklch,var(--status-done)_8%,transparent)] text-status-done"
          : "border border-[color-mix(in_oklch,var(--ao-accent-line)_35%,transparent)] bg-[color-mix(in_oklch,var(--ao-accent-line)_8%,transparent)] text-ao-fg-1")
      }
    >
      <Icon name={upToDate ? "check" : "sparkle"} size={12} />
      {upToDate ? "Up to date" : "Changes available"}
    </span>
  );
}

function CountTile({
  icon,
  label,
  count,
  tone,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  count: number;
  tone: "accent" | "warning" | "neutral";
}) {
  const dim = count === 0;
  return (
    <div
      className={
        "flex items-center gap-[10px] px-[12px] py-[10px] rounded-[8px] border flex-1 min-w-[180px] " +
        (dim
          ? "border-ao-line-1 bg-ao-bg-3"
          : tone === "accent"
            ? "border-[color-mix(in_oklch,var(--ao-accent-line)_40%,transparent)] bg-[color-mix(in_oklch,var(--ao-accent-line)_6%,transparent)]"
            : tone === "warning"
              ? "border-[color-mix(in_oklch,var(--warning,#c88a00)_40%,transparent)] bg-[color-mix(in_oklch,var(--warning,#c88a00)_6%,transparent)]"
              : "border-ao-line-1 bg-ao-bg-3")
      }
    >
      <Icon name={icon} size={14} className={dim ? "text-txt-4" : "text-txt-2"} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[11px] uppercase tracking-[0.06em] text-txt-3 truncate">
          {label}
        </span>
        <span
          className={
            "font-mono text-[18px] tabular-nums " +
            (dim ? "text-txt-4" : "text-txt")
          }
        >
          {count}
        </span>
      </div>
    </div>
  );
}
