"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";

export type HistoryEntry = {
  filename: string;
  ts: number;
  sizeBytes: number;
};

type Props = {
  agentId: string;
  onRestore: (body: string) => void;
};

export function BodyHistoryPanel({ agentId, onRestore }: Props) {
  const historyQ = useQuery({
    queryKey: ["agents", "body-history", agentId],
    queryFn: () =>
      apiFetch<HistoryEntry[]>(`/api/agents/${encodeURIComponent(agentId)}/body/history`),
  });

  const entries = historyQ.data ?? [];

  const handleRestore = async (entry: HistoryEntry) => {
    try {
      const content = await apiFetch<string>(
        `/api/agents/${encodeURIComponent(agentId)}/body/history/${encodeURIComponent(entry.filename)}`,
        { asText: true },
      );
      onRestore(content);
    } catch {
      // surface nothing — the parent form will stay unchanged
    }
  };

  if (historyQ.isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton width="100%" height={120} />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: "24px 16px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--txt-3)",
        }}
      >
        No saved versions yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map((entry) => {
        const date = new Date(entry.ts).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const kb = (entry.sizeBytes / 1024).toFixed(1);
        return (
          <div
            key={entry.filename}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Saved {date}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--txt-3)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 2,
                }}
              >
                {kb} KB · {entry.filename}
              </div>
            </div>
            <button
              type="button"
              className="btn sm"
              onClick={() => handleRestore(entry)}
              title={`Restore version saved ${date}`}
            >
              <Icon name="refresh" />
              Restore
            </button>
          </div>
        );
      })}
    </div>
  );
}
