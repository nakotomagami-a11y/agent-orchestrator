"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { TextInput } from "@/components/ui/text-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { useScanProjects, useSettings, useWriteSettings } from "../hooks/use-settings";

export function SettingsPage() {
  const t = useTranslations();
  const settingsQ = useSettings();
  const writeMut = useWriteSettings();

  const [root, setRoot] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [excludedDraft, setExcludedDraft] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (settingsQ.data) {
      setRoot(settingsQ.data.projectsRoot);
      setExcluded(settingsQ.data.excluded);
    }
  }, [settingsQ.data]);

  const scanQ = useScanProjects(root, excluded);

  const onSave = () => {
    writeMut.mutate(
      { projectsRoot: root.trim(), excluded },
      { onSuccess: () => setSavedAt(Date.now()) },
    );
  };

  const addExclusion = () => {
    const v = excludedDraft.trim();
    if (!v || excluded.includes(v)) return;
    setExcluded((prev) => [...prev, v]);
    setExcludedDraft("");
  };

  if (settingsQ.isLoading) {
    return (
      <div className="tab-pane">
        <Skeleton width="100%" height={120} />
      </div>
    );
  }

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <CardHeader title="Projects root" sub="absolute path; ~ is expanded" />
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <TextInput
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            placeholder="/home/you/Documents"
          />
          <div>
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
              Exclusions
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <TextInput
                value={excludedDraft}
                onChange={(e) => setExcludedDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExclusion();
                  }
                }}
                placeholder="node_modules"
              />
              <button type="button" className="btn" onClick={addExclusion}>
                <Icon name="plus" />
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {excluded.map((e) => (
                <span key={e} className="attach-chip">
                  {e}
                  <span
                    role="button"
                    className="x"
                    onClick={() => setExcluded((prev) => prev.filter((x) => x !== e))}
                  >
                    <Icon name="x" size={11} />
                  </span>
                </span>
              ))}
              {excluded.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--txt-3)" }}>none</span>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {savedAt ? (
              <span style={{ alignSelf: "center", fontSize: 12, color: "var(--done)" }}>Saved.</span>
            ) : null}
            <button
              type="button"
              className="btn primary"
              disabled={writeMut.isPending || !root.trim()}
              onClick={onSave}
            >
              {writeMut.isPending ? "Saving…" : t("common.save")}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scanned projects"
          sub={`${scanQ.data?.filter((e) => !e.excluded).length ?? 0} visible · ${scanQ.data?.filter((e) => e.excluded).length ?? 0} excluded`}
        />
        <div style={{ padding: 16 }}>
          {scanQ.isLoading ? (
            <Skeleton width="100%" height={80} />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {(scanQ.data ?? []).map((entry) => (
                <li
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 8px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    color: entry.excluded ? "var(--txt-4)" : "var(--txt)",
                    background: entry.excluded ? "transparent" : "var(--bg-2)",
                  }}
                >
                  <Icon name="folder" size={13} />
                  <span style={{ fontWeight: 500 }}>{entry.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>{entry.fullPath}</span>
                  {entry.excluded ? (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--txt-4)" }}>excluded</span>
                  ) : null}
                </li>
              ))}
              {!scanQ.data || scanQ.data.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--txt-3)" }}>nothing under that root</span>
              ) : null}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
