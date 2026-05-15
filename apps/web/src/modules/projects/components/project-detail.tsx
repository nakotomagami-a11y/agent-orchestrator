"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/ui/tag";
import { Icon } from "@/components/ui/icon";
import { useProject, useRemoveInstance, useUpdateProject } from "../hooks/use-projects";
import { useOfficeStore } from "@/modules/office/hooks/use-office-store";
import { ProjectActivity } from "./project-activity";
import { MemoryEditor } from "@/modules/memory/components/memory-editor";

function ProjectSaveCard({ id }: { id: string }) {
  const t = useTranslations();
  const [includeHistory, setIncludeHistory] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const url = `/api/save/export?projectId=${encodeURIComponent(id)}${includeHistory ? "&history=1" : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/save/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (res.ok) {
        setImportStatus({ ok: true, msg: t("project_detail.import_success", { count: data.agentCount }) });
      } else {
        setImportStatus({ ok: false, msg: data.detail ?? data.error ?? "Import failed" });
      }
    } catch (err) {
      setImportStatus({ ok: false, msg: String(err) });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader
        title={t("project_detail.save_card_title")}
        sub={t("project_detail.save_card_sub")}
      />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeHistory}
            onChange={(e) => setIncludeHistory(e.target.checked)}
          />
          {t("project_detail.save_include_history")}
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn primary" onClick={onExport}>
            {t("project_detail.save_export_button")}
          </button>
          <button
            type="button"
            className="btn"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? t("common.loading") : t("project_detail.save_import_button")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={onImport}
          />
        </div>
        {importStatus && (
          <span style={{ fontSize: 12, color: importStatus.ok ? "var(--done)" : "var(--error)" }}>
            {importStatus.msg}
          </span>
        )}
      </div>
    </Card>
  );
}

export type ProjectDetailProps = { id: string };

export function ProjectDetail({ id }: ProjectDetailProps) {
  const t = useTranslations();
  const projectQ = useProject(id);
  const updateMut = useUpdateProject();
  const removeMut = useRemoveInstance();
  const openChat = useOfficeStore((s) => s.select);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  if (projectQ.isLoading) {
    return (
      <div className="tab-pane">
        <Skeleton width="100%" height={200} />
      </div>
    );
  }
  if (!projectQ.data) {
    return <div className="tab-pane">{t("errors.not_found")}</div>;
  }

  const project = projectQ.data;

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <CardHeader title={project.meta.name} sub={project.meta.cwd} />
        <div style={{ padding: 16, fontSize: 13, color: "var(--txt-2)" }}>
          {project.meta.description || t("project_detail.no_description")}
        </div>
      </Card>

<ProjectActivity projectId={id} />

      <Card>
        <CardHeader
          title={t("project_detail.roster_card_title")}
          sub={t("project_detail.roster_card_sub", { count: project.meta.roster.length })}
        />
        <div>
          {project.meta.roster.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--txt-3)" }}>
              {t("project_detail.roster_empty")}
            </div>
          ) : (
            project.meta.roster.map((inst) => (
              <div
                key={inst.instanceId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <Icon name="users" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inst.label ?? inst.agentId}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>
                    {inst.instanceId} · {inst.agentId}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {inst.model ? <Tag>{t("project_detail.tag_model", { model: inst.model })}</Tag> : null}
                  {inst.effort ? <Tag>{t("project_detail.tag_effort", { effort: inst.effort })}</Tag> : null}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {pendingRemoveId === inst.instanceId ? (
                    <>
                      <span style={{ fontSize: 12, color: "var(--txt-3)" }}>
                        {t("project_detail.remove_inline_confirm", { label: inst.label ?? inst.agentId })}
                      </span>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setPendingRemoveId(null)}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => {
                          removeMut.mutate({ projectId: id, instanceId: inst.instanceId });
                          setPendingRemoveId(null);
                        }}
                      >
                        {t("common.remove")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn sm primary"
                        onClick={() => openChat(inst.agentId, { instanceId: inst.instanceId })}
                      >
                        <Icon name="send" /> {t("project_detail.chat_button")}
                      </button>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => setPendingRemoveId(inst.instanceId)}
                        title={t("project_detail.remove_title")}
                      >
                        <Icon name="x" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t("project_detail.memory_card_title")}
          sub={t("project_detail.memory_card_sub", { project: project.meta.name })}
        />
        <div style={{ padding: 16 }}>
          <MemoryEditor
            value={project.memory}
            onSave={(content) =>
              updateMut.mutateAsync({ id, patch: { memory: content } })
            }
            rows={12}
            placeholder={t("project_detail.memory_placeholder")}
            saveLabel={t("common.save")}
          />
        </div>
      </Card>

      <ProjectSaveCard id={id} />
    </div>
  );
}
