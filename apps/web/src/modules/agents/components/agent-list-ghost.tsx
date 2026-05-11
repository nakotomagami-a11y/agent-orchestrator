"use client";

import { Skeleton } from "@/components/ui/skeleton";

export type AgentListGhostProps = {
  count?: number;
};

/**
 * Ghost layout for AgentList loading state.
 * Mirrors the loaded card shape: 40×40 avatar + name/category block + edit
 * button placeholder, description block, skills row, footer row.
 */
export function AgentListGhost({ count = 4 }: AgentListGhostProps) {
  return (
    <div
      className="tab-pane"
      style={{ padding: 18, overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}
      aria-busy="true"
      aria-label="Loading agents"
      role="status"
    >
      {/* Search bar ghost */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: "1 1 320px", maxWidth: 480 }}>
            <Skeleton width="100%" height={32} rounded={8} />
          </div>
        </div>
      </div>

      {/* Card grid ghost */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
          alignContent: "start",
        }}
        aria-hidden="true"
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              pointerEvents: "none",
            }}
          >
            {/* Header: avatar + name/category + edit button placeholder */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Skeleton width={40} height={40} rounded={8} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                <Skeleton width={130} height={14} />
                <Skeleton width={80} height={11} />
              </div>
              <Skeleton width={24} height={24} rounded={6} />
            </div>

            {/* Description: two lines */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Skeleton width="100%" height={12} />
              <Skeleton width="75%" height={12} />
            </div>

            {/* Skills row */}
            <div style={{ display: "flex", gap: 4 }}>
              <Skeleton width={60} height={20} rounded={999} />
              <Skeleton width={50} height={20} rounded={999} />
              <Skeleton width={45} height={20} rounded={999} />
            </div>

            {/* Footer: model tag + uses count */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
              <Skeleton width={80} height={20} rounded={999} />
              <Skeleton width={55} height={11} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
