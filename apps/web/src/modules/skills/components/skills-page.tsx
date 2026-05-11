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
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <CardHeader
          title={t("skills.title")}
          sub={t("skills.card_sub", { installed: installedCount, total: registryQ.data?.length ?? 0 })}
        />
        <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <TextInput
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
              placeholder={t("skills.filter_placeholder")}
            />
          </div>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
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
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="cpu" />
          <strong style={{ fontSize: 13 }}>{skill.name}</strong>
          {skill.installed ? (
            <Tag style={{ marginLeft: "auto", background: "var(--acc-faint)", color: "var(--acc)" }}>{t("skills.installed_badge")}</Tag>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: "var(--txt-2)", minHeight: 32 }}>
          {skill.description || t("skills.description_empty")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {skill.tags.slice(0, 4).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>
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
