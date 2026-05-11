import { useEffect, useState } from "react";
import { I } from "./Avatars";
import * as api from "./api";
import type { AppSettings, ScannedEntry } from "./types";

interface Props {
  onComplete: (settings: AppSettings) => void;
  onClose?: () => void;          // shown only when re-editing
  initial?: AppSettings | null;  // pre-populate for reconfigure
}

const DEFAULT_PROJECTS_ROOT = "~/Documents";

export function FirstRunWizard({ onComplete, onClose, initial }: Props) {
  const [root, setRoot] = useState(initial?.projectsRoot ?? DEFAULT_PROJECTS_ROOT);
  const [excluded, setExcluded] = useState<Set<string>>(new Set(initial?.excluded ?? []));
  const [entries, setEntries] = useState<ScannedEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Debounce scan as the user types
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!root.trim()) { setEntries([]); return; }
      setScanning(true);
      setError(null);
      try {
        const list = await api.scanProjectsRoot(root, [], true);
        if (!cancelled) {
          setEntries(list);
          if (list.length === 0) {
            setError(`No subdirectories found at ${root}`);
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setScanning(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [root]);

  function toggle(name: string) {
    const next = new Set(excluded);
    if (next.has(name)) next.delete(name); else next.add(name);
    setExcluded(next);
  }

  async function finish() {
    if (!root.trim()) { setError("Pick a projects folder"); return; }
    setSaving(true);
    try {
      const settings = await api.saveSettings({
        projectsRoot: root.trim(),
        excluded: Array.from(excluded),
      });
      onComplete(settings);
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  const included = entries.filter(e => !excluded.has(e.name));

  return (
    <div className="wizard-scrim" style={{ background: initial ? "rgba(0,0,0,0.7)" : "rgba(0, 0, 0, 0.85)" }} onClick={onClose}>
      <div className="wizard" style={{ gridTemplateRows: "auto 1fr auto", width: "min(640px, 100%)" }}
        onClick={e => e.stopPropagation()}>
        <div className="wizard-head">
          <h2>{initial ? "Projects folder" : "Welcome to Agent Office"}</h2>
          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: 8 }}>
            {initial ? "edit settings" : "one-time setup"}
          </span>
          {onClose && (
            <button className="x" style={{ marginLeft: "auto" }} onClick={onClose}>×</button>
          )}
        </div>

        <div className="wizard-body scroll">
          {!initial && (
            <p style={{ fontSize: 13, color: "var(--txt-1)", lineHeight: 1.5, marginTop: 0 }}>
              Tell me where you keep your projects. Each subdirectory becomes a project you can
              switch between. You can change this later in <b>Manage projects</b>, and you can
              also work without a project — just pick <b>None</b> in the switcher.
            </p>
          )}

          <div style={{ marginTop: 16, marginBottom: 14 }}>
            <label style={{
              display: "block", fontSize: 11, color: "var(--txt-2)",
              fontWeight: 500, marginBottom: 6, textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>Projects folder</label>
            <input
              className="input"
              value={root}
              onChange={e => setRoot(e.target.value)}
              placeholder="e.g. ~/Documents/Lab or /home/me/code"
              autoFocus
              style={{ fontFamily: "var(--mono)" }}
            />
          </div>

          {scanning && entries.length === 0 && (
            <div style={{ color: "var(--txt-3)", fontSize: 12, padding: "10px 0" }}>scanning…</div>
          )}

          {error && entries.length === 0 && (
            <div style={{
              color: "var(--error)", fontSize: 12, fontFamily: "var(--mono)",
              padding: "10px 14px",
              background: "color-mix(in oklch, var(--error) 12%, transparent)",
              border: "1px solid color-mix(in oklch, var(--error) 30%, transparent)",
              borderRadius: 6,
            }}>{error}</div>
          )}

          {entries.length > 0 && (
            <>
              <div style={{
                display: "flex", alignItems: "baseline", gap: 10,
                marginBottom: 10, paddingBottom: 4,
                borderBottom: "1px solid var(--line)",
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Found {entries.length} folder{entries.length === 1 ? "" : "s"}
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
                  {included.length} included · {excluded.size} excluded
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }} className="scroll">
                {entries.map(e => {
                  const isExcluded = excluded.has(e.name);
                  return (
                    <button
                      key={e.name}
                      onClick={() => toggle(e.name)}
                      style={{
                        display: "grid", gridTemplateColumns: "22px 1fr auto",
                        gap: 10, alignItems: "center",
                        padding: "8px 12px",
                        background: isExcluded ? "var(--bg-2)" : "var(--acc-subtle)",
                        border: "1px solid " + (isExcluded ? "var(--line)" : "var(--acc)"),
                        borderRadius: 6,
                        cursor: "pointer", textAlign: "left",
                        opacity: isExcluded ? 0.5 : 1,
                      }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 4,
                        background: isExcluded ? "var(--bg-2)" : "var(--acc)",
                        border: "1px solid " + (isExcluded ? "var(--line-strong)" : "var(--acc)"),
                        color: isExcluded ? "transparent" : "var(--acc-text)",
                        display: "grid", placeItems: "center",
                      }}>{!isExcluded && <I.Check style={{ width: 14, height: 14 }} />}</span>
                      <span style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--mono)" }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "var(--mono)" }}>{e.fullPath}</div>
                      </span>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
                        {isExcluded ? "excluded" : "included"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 8 }}>
                Click a folder to toggle exclusion. Hidden folders (starting with <code>.</code>) are always skipped.
              </div>
            </>
          )}
        </div>

        <div className="wizard-foot">
          <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
            Settings live at <code>~/.claude/agent-office-settings.json</code>
          </div>
          <div className="right">
            <button
              className="btn primary"
              onClick={finish}
              disabled={saving || !root.trim() || included.length === 0}
              title={included.length === 0 ? "Pick at least one folder to include" : ""}>
              {saving ? "Saving…" : (initial ? "Save" : "Get started")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
