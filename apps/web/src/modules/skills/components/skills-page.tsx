"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { TextInput } from "@/components/ui/text-input";
import { Tag } from "@/components/ui/tag";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { useInstallSkill, useRegistry, useUninstallSkill } from "../hooks/use-skills";
import { filterRegistry, type RegistryFilter } from "../utils/filter-registry";
import type { RegistrySkill } from "@agent-office/shared/types";

export function SkillsPage() {
  const t = useTranslations();
  const registryQ = useRegistry();
  const installMut = useInstallSkill();
  const uninstallMut = useUninstallSkill();

  const [filter, setFilter] = useState<RegistryFilter>({ q: "", showInstalledOnly: false });

  const filtered = useMemo(() => filterRegistry(registryQ.data ?? [], filter), [registryQ.data, filter]);
  const installedCount = (registryQ.data ?? []).filter((s) => s.installed).length;

  return (
    <div className="tab-pane flex flex-col gap-[14px]">
      <Card>
        <CardHeader
          title={t("skills.title")}
          sub={t("skills.card_sub", { installed: installedCount, total: registryQ.data?.length ?? 0 })}
        />
        <div className="p-4 flex gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <TextInput
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
              placeholder={t("skills.filter_placeholder")}
            />
          </div>
          <label className="inline-flex gap-[6px] items-center text-[12.5px]">
            <input
              type="checkbox"
              checked={filter.showInstalledOnly}
              onChange={(e) => setFilter((f) => ({ ...f, showInstalledOnly: e.target.checked }))}
            />
            {t("skills.installed_only_label")}
          </label>
        </div>
      </Card>

      {registryQ.isLoading ? (
        <Skeleton width="100%" height={300} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="cpu" title={t("skills.no_results_title")} description={t("common.empty")} />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((s) => (
            <SkillCard
              key={`${s.source}-${s.name}`}
              skill={s}
              busy={installMut.isPending || uninstallMut.isPending}
              onInstall={() =>
                installMut.mutate({ source: s.source, ref: s.ref, path: s.path, name: s.name })
              }
              onUninstall={() => uninstallMut.mutate(s.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillCard({
  skill,
  busy,
  onInstall,
  onUninstall,
}: {
  skill: RegistrySkill;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const t = useTranslations();
  return (
    <Card>
      <div className="p-[14px] flex flex-col gap-2 h-full">
        <div className="flex items-center gap-2">
          <Icon name="cpu" />
          <strong className="text-[13px]">{skill.name}</strong>
          {skill.installed ? (
            <Tag className="ml-auto bg-acc-faint text-acc">{t("skills.installed_badge")}</Tag>
          ) : null}
        </div>
        <div className="text-xs text-txt-2 min-h-8">
          {skill.description || t("skills.description_empty")}
        </div>
        <div className="flex flex-wrap gap-1">
          {skill.tags.slice(0, 4).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="font-mono text-[11px] text-txt-3">
            {skill.source}@{skill.ref}
          </span>
          {skill.installed ? (
            <button type="button" className="btn sm" onClick={onUninstall} disabled={busy}>
              {t("skills.remove_button")}
            </button>
          ) : (
            <button type="button" className="btn sm primary" onClick={onInstall} disabled={busy}>
              {t("skills.install_button")}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
