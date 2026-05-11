import { useEffect, useRef, useState } from "react";
import { I } from "./Avatars";
import type { Project, ProjectSummary } from "./types";

interface Props {
  projects: ProjectSummary[];
  current: Project | null;
  onSwitch: (id: string | null) => void;
  onManage: () => void;
  onReconfigure: () => void;
}

export function ProjectSwitcher({ projects, current, onSwitch, onManage, onReconfigure }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const label = current?.meta.name ?? "No project";
  const isNoProject = current == null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="topbar-btn"
        onClick={() => setOpen(v => !v)}
        title="Switch project"
      >
        <I.Folder />
        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{ color: "var(--txt-3)", fontSize: 10, marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
          minWidth: 260,
          background: "var(--bg-2)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--r-md)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          padding: 4,
        }}>
          <button
            onClick={() => { onSwitch(null); setOpen(false); }}
            style={{
              display: "grid",
              gridTemplateColumns: "16px 1fr auto",
              gap: 10, alignItems: "center",
              width: "100%", textAlign: "left",
              padding: "6px 10px",
              background: isNoProject ? "var(--acc-subtle)" : "transparent",
              border: 0, borderRadius: 4,
              color: "var(--txt)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}>
            <span style={{ color: "var(--acc)" }}>{isNoProject ? <I.Check /> : null}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500, fontStyle: "italic" }}>No project</span>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
                Chat or work on anything · agent inherits server cwd
              </div>
            </span>
          </button>
          {projects.length > 0 && (
            <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
          )}
          <div style={{
            padding: "6px 10px 4px",
            fontSize: 10, color: "var(--txt-3)",
            fontFamily: "var(--mono)", textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Projects ({projects.length})
          </div>
          {projects.map(p => {
            const isCurrent = p.id === current?.id;
            return (
              <button
                key={p.id}
                onClick={() => { onSwitch(p.id); setOpen(false); }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "16px 1fr auto",
                  gap: 10, alignItems: "center",
                  width: "100%", textAlign: "left",
                  padding: "6px 10px",
                  background: isCurrent ? "var(--acc-subtle)" : "transparent",
                  border: 0, borderRadius: 4,
                  color: "var(--txt)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                <span style={{ color: "var(--acc)" }}>{isCurrent ? <I.Check /> : null}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
                    {p.instanceCount} instance{p.instanceCount === 1 ? "" : "s"}
                    {p.cwd && <> · cwd {p.cwd}</>}
                  </div>
                </span>
              </button>
            );
          })}
          <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
          <button
            onClick={() => { onManage(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "6px 10px",
              background: "transparent", border: 0, borderRadius: 4,
              color: "var(--txt-1)",
              fontFamily: "inherit", fontSize: 13, cursor: "pointer", textAlign: "left",
            }}>
            <I.Settings /> Manage projects…
          </button>
          <button
            onClick={() => { onReconfigure(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "6px 10px",
              background: "transparent", border: 0, borderRadius: 4,
              color: "var(--txt-1)",
              fontFamily: "inherit", fontSize: 13, cursor: "pointer", textAlign: "left",
            }}>
            <I.Folder /> Projects folder…
          </button>
        </div>
      )}
    </div>
  );
}
