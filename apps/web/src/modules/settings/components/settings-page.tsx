"use client";

import { useState, useEffect } from "react";
import { match } from "ts-pattern";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { TextInput } from "@/components/ui/text-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { useScanProjects, useSettings, useWriteSettings } from "../hooks/use-settings";
import { AboutYouTab } from "./tabs/about-you-tab";

type TabValue = "projects" | "about-you";

export function SettingsPage() {
  const t = useTranslations();
  const [tab, setTab] = useState<TabValue>("projects");

  return (
    <>
      <Tabs<TabValue>
        items={[
          { value: "projects", label: t("settings.tab_projects") },
          { value: "about-you", label: t("settings.tab_about_you") },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel={t("settings.tabs_aria")}
      />
      <div className="overflow-auto py-[18px] px-6 flex flex-col gap-[14px]">
        {match(tab)
          .with("projects", () => <ProjectsPane />)
          .with("about-you", () => <AboutYouTab />)
          .exhaustive()}
      </div>
    </>
  );
}

/**
 * Projects pane — the original single-view settings surface: pick the
 * projects root, manage exclusions, and preview what the scanner picks up.
 * Extracted so the About You tab can sit next to it under a Tabs header
 * without leaking form state across tabs.
 */
function ProjectsPane() {
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
    return <Skeleton width="100%" height={120} />;
  }

  return (
    <>
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
              <Button onClick={addExclusion}>
                <Icon name="plus" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {excluded.map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ao-line-1/20 border border-ao-line-1/40 text-sm text-ao-fg-1 font-mono"
                >
                  {e}
                  <button
                    type="button"
                    className="ml-0.5 inline-flex items-center justify-center rounded-sm p-0.5 text-ao-fg-2 hover:text-ao-fg-0 hover:bg-ao-line-1/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ao-accent-line"
                    aria-label={t("settings.exclusion_remove_aria", { name: e })}
                    onClick={() => setExcluded((prev) => prev.filter((x) => x !== e))}
                  >
                    <Icon name="x" size={12} />
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
            <Button
              variant="primary"
              disabled={writeMut.isPending || !root.trim()}
              onClick={onSave}
            >
              {writeMut.isPending ? t("common.saving") : t("common.save")}
            </Button>
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
    </>
  );
}
