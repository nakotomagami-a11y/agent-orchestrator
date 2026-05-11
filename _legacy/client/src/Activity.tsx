import { I } from "./Avatars";
import { relTime } from "./helpers";
import type { Run } from "./types";

interface DrawerProps {
  items: Run[];
  onClose: () => void;
  onJump: (agentId: string) => void;
  scopeLabel?: string;       // e.g. "Default" — shown when scoped to a project
  showAll?: boolean;
  onSetShowAll?: (v: boolean) => void;
}

export function ActivityDrawer({ items, onClose, onJump, scopeLabel, showAll, onSetShowAll }: DrawerProps) {
  const running = items.filter(r => r.status === "running");
  const recent = items.filter(r => r.status !== "running").slice(0, 30);
  return (
    <aside className="activity">
      <div className="activity-head">
        <I.Activity />
        <span className="title">Activity</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--txt-3)" }}>
          {running.length} running · {recent.length} recent
        </span>
        <button className="topbar-btn" style={{ height: 24, padding: "0 6px" }} onClick={onClose}>
          <I.X />
        </button>
      </div>
      {scopeLabel && onSetShowAll && (
        <div style={{
          padding: "8px 14px",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 11.5,
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-1)",
        }}>
          <span style={{ color: "var(--txt-3)" }}>scope</span>
          <button
            onClick={() => onSetShowAll(false)}
            style={{
              padding: "2px 8px", borderRadius: 99,
              background: showAll ? "var(--bg-2)" : "var(--acc-subtle)",
              border: "1px solid " + (showAll ? "var(--line)" : "var(--acc)"),
              color: showAll ? "var(--txt-2)" : "var(--acc)",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>{scopeLabel}</button>
          <button
            onClick={() => onSetShowAll(true)}
            style={{
              padding: "2px 8px", borderRadius: 99,
              background: showAll ? "var(--acc-subtle)" : "var(--bg-2)",
              border: "1px solid " + (showAll ? "var(--acc)" : "var(--line)"),
              color: showAll ? "var(--acc)" : "var(--txt-2)",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>All projects</button>
        </div>
      )}
      <div className="activity-list scroll">
        {running.length > 0 && (
          <>
            <div style={{
              padding: "8px 14px 4px", fontFamily: "var(--mono)", fontSize: 10,
              textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--txt-3)",
            }}>Running now</div>
            {running.map(r => <ActivityItem key={r.id} run={r} onJump={onJump} />)}
          </>
        )}
        <div style={{
          padding: "12px 14px 4px", fontFamily: "var(--mono)", fontSize: 10,
          textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--txt-3)",
        }}>Recent</div>
        {recent.map(r => <ActivityItem key={r.id} run={r} onJump={onJump} />)}
      </div>
    </aside>
  );
}

function ActivityItem({ run, onJump }: { run: Run; onJump: (id: string) => void }) {
  const dotClass = run.status === "running" ? "working" : run.status === "error" ? "error" : "done";
  return (
    <div className="activity-item" onClick={() => onJump(run.agentId)}>
      <span className={"statusdot " + dotClass}></span>
      <div style={{ minWidth: 0 }}>
        <div className="name">{run.agentName}</div>
        <div className="what">{run.prompt}</div>
      </div>
      <div className="when">{relTime(run.ts)}</div>
    </div>
  );
}

export function PipStrip({ runs, onJump, onDismiss }: {
  runs: Run[];
  onJump: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (!runs.length) return <span style={{ flex: 1 }} />;
  return (
    <div className="pip-strip">
      {runs.map(r => (
        <div key={r.id} className={"pip " + (r.status === "running" ? "" : r.status)} onClick={() => onJump(r.agentId)}>
          <span className="dot"></span>
          <span style={{ color: "var(--txt)", fontWeight: 500 }}>{r.agentName}</span>
          <span style={{ color: "var(--txt-3)" }}>·</span>
          <span style={{
            maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{r.prompt.slice(0, 32)}…</span>
          <span className="x" onClick={e => { e.stopPropagation(); onDismiss(r.id); }}>×</span>
        </div>
      ))}
    </div>
  );
}
