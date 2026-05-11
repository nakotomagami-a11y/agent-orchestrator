// FloorPlan — single open area, no rooms. Desks are laid out in a responsive
// grid; the only structural feature is the optional dashed "Add agent" tile.
// Seat is the abstraction over either an instance (project mode) or a global
// agent (no-project mode); App.tsx builds them and we render them.

import { Avatar, I, type AvatarStyle } from "./Avatars";
import type { Agent } from "./types";

export interface Seat {
  seatId: string;
  agentId: string;
  instanceId?: string;
  label: string;
  status: Agent["status"];
  room?: string;       // kept on the model but not used for layout
  skills: string[];
}

interface FloorProps {
  seats: Seat[];
  agentById: Record<string, Agent>;
  selectedSeatId: string | null;
  onSelect: (seatId: string) => void;
  onAddAgent?: () => void;
  avatarStyle: AvatarStyle;
  emptyState?: { title: string; hint: string; cta?: { label: string; onClick: () => void } };
}

export function FloorPlan({
  seats, agentById, selectedSeatId, onSelect, avatarStyle, emptyState, onAddAgent,
}: FloorProps) {
  if (emptyState) {
    return (
      <div className="floorplan scroll" style={{ display: "grid", placeItems: "center" }}>
        <div style={{
          maxWidth: 480, textAlign: "center", padding: 32,
          color: "var(--txt-2)", lineHeight: 1.5,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)", marginBottom: 8 }}>
            {emptyState.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--txt-2)" }}>{emptyState.hint}</div>
          {emptyState.cta && (
            <button className="btn primary" style={{ marginTop: 18 }} onClick={emptyState.cta.onClick}>
              <I.Plus /> {emptyState.cta.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="floorplan scroll" style={{ overflow: "auto", padding: 24 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
        gap: 14,
        alignContent: "start",
      }}>
        {seats.map(seat => {
          const a = agentById[seat.agentId];
          const isSelected = selectedSeatId === seat.seatId;
          return (
            <div key={seat.seatId}
              className={"desk " + seat.status + (isSelected ? " selected" : "")}
              style={{ position: "static", width: "100%", minHeight: 88 }}
              onClick={() => onSelect(seat.seatId)}
              title={seat.label + " — " + seat.status}>
              <div className="desk-top">
                <span className={"statusdot " + seat.status}></span>
                <span style={{ color: "var(--txt-2)", fontSize: 8 }}>
                  {seat.instanceId ? seat.instanceId.slice(0, 12) : seat.agentId.slice(0, 8)}
                </span>
              </div>
              <div className="desk-body">
                {a ? <Avatar agent={a} style={avatarStyle} size={32} /> : <div style={{ width: 32, height: 32 }} />}
                <div className="lbl">
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{seat.label}</div>
                  <div style={{ fontSize: 9, color: "var(--txt-3)", marginTop: 1 }}>
                    {seat.instanceId ? seat.agentId : (seat.skills[0] ?? "")}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {onAddAgent && (
          <button
            onClick={onAddAgent}
            style={{
              minHeight: 88,
              background: "transparent",
              border: "1.5px dashed var(--line-strong)",
              borderRadius: 6,
              color: "var(--txt-2)",
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              fontFamily: "inherit", fontSize: 11,
            }}
            title="Add an agent to this project">
            <I.Plus /> Add agent
          </button>
        )}
      </div>
    </div>
  );
}

export function FloorHeader({
  runningCount, totalSeats, title, subtitle,
}: {
  runningCount: number;
  totalSeats: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px", borderBottom: "1px solid var(--line)",
    }}>
      <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h1>
      <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
        {runningCount} working · {totalSeats} {totalSeats === 1 ? "desk" : "desks"}
      </div>
      <div style={{ marginLeft: "auto" }} className="row">
        <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
          {subtitle ?? "tap a desk to focus an agent"}
        </span>
      </div>
    </div>
  );
}
