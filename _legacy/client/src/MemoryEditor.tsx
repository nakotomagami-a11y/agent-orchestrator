import { useEffect, useRef, useState } from "react";
import { I } from "./Avatars";

interface Props {
  endpoint: string;
  title: string;
  subtitle?: string;
  hint?: React.ReactNode;
  onDirtyChange?: (dirty: boolean) => void;
}

export function MemoryEditor({ endpoint, title, subtitle, hint, onDirtyChange }: Props) {
  const [content, setContent] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(endpoint)
      .then(async r => {
        if (!r.ok && r.status !== 404) throw new Error(await r.text());
        return r.status === 404 ? "" : r.text();
      })
      .then(text => {
        if (cancelled) return;
        setContent(text);
        setOriginal(text);
      })
      .catch(e => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [endpoint]);

  const dirty = content !== original;

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => { onDirtyChange?.(false); };
  }, [dirty, onDirtyChange]);

  // Warn on tab close / refresh while dirty
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: content,
      });
      if (!res.ok) throw new Error(await res.text());
      setOriginal(content);
      setSavedAt(Date.now());
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setContent(original);
    taRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (dirty && !saving) save();
    }
  }

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="card-h">
        <span className="title">{title}</span>
        {subtitle && <span style={{ color: "var(--txt-3)" }}>{subtitle}</span>}
        <div className="right">
          <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>
            {wordCount} word{wordCount === 1 ? "" : "s"}
            {savedAt && !dirty && (
              <> · saved <span style={{ color: "var(--done)" }}>✓</span></>
            )}
            {dirty && <> · <span style={{ color: "var(--working)" }}>unsaved</span></>}
          </span>
        </div>
      </div>

      {hint && (
        <div style={{
          padding: "8px 14px", borderBottom: "1px solid var(--line)",
          fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.5,
          background: "var(--bg-1)",
        }}>
          {hint}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: 14, gap: 10 }}>
        <textarea
          ref={taRef}
          className="prompt-input scroll"
          style={{ flex: 1, minHeight: 200, fontSize: 12.5, lineHeight: 1.6 }}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKey}
          placeholder={loading ? "loading…" : "Write notes, conventions, or facts that should always be in this agent's context.\n\nExamples:\n- preferred libraries\n- past decisions and their rationale\n- areas of the codebase to avoid\n- recurring constraints\n\n(Cmd/Ctrl+S to save)"}
          disabled={loading}
        />

        {error && (
          <div style={{ fontSize: 12, color: "var(--error)", fontFamily: "var(--mono)" }}>
            {error}
          </div>
        )}

        <div className="summon-actions">
          <button
            className="btn primary"
            onClick={save}
            disabled={!dirty || saving || loading}
          >
            <I.Check /> {saving ? "Saving…" : "Save"}
          </button>
          <button
            className="btn ghost"
            onClick={discard}
            disabled={!dirty || saving}
          >
            Discard
          </button>
          <div className="budget" style={{ marginLeft: "auto" }}>
            <span className="kbd">⌘S</span>
            <span style={{ color: "var(--txt-3)" }}>save</span>
          </div>
        </div>
      </div>
    </div>
  );
}
