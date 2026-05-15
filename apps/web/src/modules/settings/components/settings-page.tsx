"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { TextInput } from "@/components/ui/text-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
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
    <div className="tab-pane flex flex-col gap-[14px]">
      <Card>
        <CardHeader title={t("settings.projects_root_card_title")} sub={t("settings.projects_root_card_sub")} />
        <div className="p-4 flex flex-col gap-3">
          <TextInput
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            placeholder={t("settings.projects_root_placeholder")}
          />
          <div>
            <div className="text-[11px] text-txt-3 font-mono uppercase tracking-[0.06em] mb-[6px]">
              {t("settings.exclusions_label")}
            </div>
            <div className="flex gap-2 mb-2">
              <TextInput
                value={excludedDraft}
                onChange={(e) => setExcludedDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExclusion();
                  }
                }}
                placeholder={t("settings.exclusions_placeholder")}
              />
              <button type="button" className="btn" onClick={addExclusion}>
                <Icon name="plus" />
              </button>
            </div>
            <div className="flex gap-[6px] flex-wrap">
              {excluded.map((e) => (
                <span key={e} className="attach-chip">
                  {e}
                  <button
                    type="button"
                    className="x bg-transparent border-none p-0 text-inherit cursor-pointer inline-flex"
                    aria-label={t("settings.exclusion_remove_aria", { name: e })}
                    onClick={() => setExcluded((prev) => prev.filter((x) => x !== e))}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </span>
              ))}
              {excluded.length === 0 ? (
                <span className="text-xs text-txt-3">{t("settings.exclusions_empty")}</span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {savedAt ? (
              <span className="self-center text-xs text-status-done">{t("common.saved")}</span>
            ) : null}
            <button
              type="button"
              className="btn primary"
              disabled={writeMut.isPending || !root.trim()}
              onClick={onSave}
            >
              {writeMut.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t("settings.scanned_card_title")}
          sub={t("settings.scanned_card_sub", {
            visible: scanQ.data?.filter((e) => !e.excluded).length ?? 0,
            excluded: scanQ.data?.filter((e) => e.excluded).length ?? 0,
          })}
        />
        <div className="p-4">
          {scanQ.isLoading ? (
            <Skeleton width="100%" height={80} />
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {(scanQ.data ?? []).map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-[10px] px-2 py-[6px] rounded-md text-[12.5px]",
                    entry.excluded ? "text-txt-4 bg-transparent" : "text-txt bg-bg-2",
                  )}
                >
                  <Icon name="folder" size={13} />
                  <span className="font-medium">{entry.name}</span>
                  <span className="font-mono text-[11px] text-txt-3">{entry.fullPath}</span>
                  {entry.excluded ? (
                    <span className="ml-auto text-[11px] text-txt-4">{t("settings.excluded_badge")}</span>
                  ) : null}
                </li>
              ))}
              {!scanQ.data || scanQ.data.length === 0 ? (
                <span className="text-xs text-txt-3">{t("settings.scanned_empty")}</span>
              ) : null}
            </ul>
          )}
        </div>
      </Card>

    </div>
  );
}
