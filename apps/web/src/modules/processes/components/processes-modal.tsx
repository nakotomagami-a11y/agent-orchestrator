"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { ModalShell } from "@/components/ui/modal-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { useProcessesStore } from "@/lib/processes-store";
import { useProcesses, useInvalidateProcesses, type ProcessInfo } from "../hooks/use-processes";

function formatAgo(epochMs: number): string {
  const diff = Math.max(0, Date.now() - epochMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Group = { label: string; processes: ProcessInfo[] };

function groupByProject(processes: ProcessInfo[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of processes) {
    const key = p.projectId ?? "__other__";
    const label = p.projectName ?? "Other";
    if (!map.has(key)) map.set(key, { label, processes: [] });
    map.get(key)!.processes.push(p);
  }
  // Named projects first, "Other" last
  const groups = Array.from(map.values());
  return [
    ...groups.filter((g) => g.label !== "Other").sort((a, b) => a.label.localeCompare(b.label)),
    ...groups.filter((g) => g.label === "Other"),
  ];
}

export function ProcessesModal() {
  const t = useTranslations();
  const open = useProcessesStore((s) => s.open);
  const setOpen = useProcessesStore((s) => s.setOpen);
  const processesQ = useProcesses(open);
  const invalidate = useInvalidateProcesses();

  const processes = processesQ.data ?? [];
  const groups = useMemo(() => groupByProject(processes), [processes]);

  async function handleKill(pid: number) {
    try {
      await apiFetch(`/api/processes/${pid}`, { method: "DELETE" });
    } catch {
      // best-effort: process may already be gone
    }
    invalidate();
  }

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t("processes.title")}
      size="md"
      footer={
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          {t("processes.close")}
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => processesQ.refetch()}
            aria-label="Refresh process list"
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              color: "var(--txt-3)",
              padding: "3px 7px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
            }}
          >
            <Icon name="refresh" size={13} />
          </button>
        </div>

        {processesQ.isLoading ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--txt-3)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {t("processes.scanning")}
            </div>
            <Skeleton width="100%" height={48} rounded={6} />
            <Skeleton width="80%" height={48} rounded={6} />
            <Skeleton width="90%" height={48} rounded={6} />
          </div>
        ) : processes.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "32px 0",
              color: "var(--txt-3)",
            }}
          >
            <Icon name="server" size={28} />
            <span style={{ fontSize: 13 }}>{t("processes.empty")}</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groups.map((group) => (
              <div key={group.label}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--txt-3)",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  {group.label}
                </div>
                <div role="list" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.processes.map((p) => (
                    <ProcessRow
                      key={p.pid}
                      process={p}
                      onKill={() => handleKill(p.pid)}
                      killAria={t("processes.kill_aria", { pid: p.pid })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function ProcessRow({
  process: p,
  onKill,
  killAria,
}: {
  process: ProcessInfo;
  onKill: () => void;
  killAria: string;
}) {
  return (
    <div
      role="listitem"
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 10,
        alignItems: "center",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: "8px 10px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--acc)",
            background: "color-mix(in srgb, var(--acc) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--acc) 30%, transparent)",
            borderRadius: 999,
            padding: "1px 8px",
            whiteSpace: "nowrap",
          }}
        >
          :{p.port}
        </span>
      </div>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {p.name}
        </span>
        {p.cmd ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--txt-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={p.cmd}
          >
            {p.cmd}
          </span>
        ) : null}
        {p.startedAt > 0 ? (
          <span style={{ fontSize: 11, color: "var(--txt-4)" }}>
            {formatAgo(p.startedAt)}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onKill}
        aria-label={killAria}
        style={{
          background: "transparent",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          cursor: "pointer",
          color: "var(--txt-3)",
          width: 26,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={11} />
      </button>
    </div>
  );
}
