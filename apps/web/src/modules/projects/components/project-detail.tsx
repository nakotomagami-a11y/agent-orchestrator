"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { PlanetCanvas } from "@/components/ui/planet-canvas";
import { PlanetEditorModal } from "@/components/ui/planet-editor-modal";
import { useGitStatus, useProject, useUpdateProject } from "../hooks/use-projects";
import { useOfficeAgents } from "@/modules/office/hooks/use-office-agents";
import { ProjectActivity } from "./project-activity";
import { AddAgentModal } from "./add-agent-modal";
import { apiFetch, ApiError } from "@agent-office/shared/hooks/api";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { exportProject, importState } from "@/lib/api/save";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CodeEditor } from "@/components/ui/code-editor";
import { ProjectActionsBar } from "@/modules/office/components/office-toolbar";
import { relativeTime } from "../utils/format";

export type ProjectDetailProps = { id: string };

export function ProjectDetail({ id }: ProjectDetailProps) {
  const t = useTranslations();
  const router = useRouter();
  const projectQ = useProject(id);
  const updateMut = useUpdateProject();

  const [memoryOverride, setMemoryOverride] = useState<string | null>(null);
  const [memoryDirty, setMemoryDirty] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);

  const [includeHistory, setIncludeHistory] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [copiedPath, setCopiedPath] = useState(false);
  const [planetEditorOpen, setPlanetEditorOpen] = useState(false);
  const [pendingDanger, setPendingDanger] = useState<"reset" | "delete" | null>(null);
  const [dangerWorking, setDangerWorking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const { agents: allAgents } = useOfficeAgents();
  const gitStatusQ = useGitStatus(id, !!projectQ.data?.meta.cwd);

  const project = projectQ.data;
  const header = (
    <PageHeader
      title="Project"
      sub={project ? `· ${project.meta.name}` : undefined}
      actions={
        <>
          <ProjectActionsBar projectId={id} />
          <button
            type="button"
            className="inline-flex items-center gap-[6px] bg-acc font-semibold cursor-pointer px-[14px] py-[8px] text-white rounded-[9px] text-[13px] transition-[background] duration-[120ms] hover:bg-[var(--acc-hover)] border-none"
            onClick={() => setAddOpen(true)}
          >
            <Icon name="plus" size={13} /> Add agent
          </button>
        </>
      }
    />
  );

  if (projectQ.isLoading) {
    return (
      <>
        {header}
        <div className="overflow-auto py-[18px] px-6">
          <Skeleton width="100%" height={200} />
        </div>
      </>
    );
  }
  if (!project) {
    return (
      <>
        {header}
        <div className="overflow-auto py-[18px] px-6">{t("errors.not_found")}</div>
      </>
    );
  }

  const memValue = memoryOverride ?? project.memory;
  const rosterCount = project.meta.roster.length;
  const rosterIds = new Set(project.meta.roster.map((r) => r.agentId));
  const projectWorkingCount = allAgents.filter(
    (a) => rosterIds.has(a.id) && (a.status === "working" || a.status === "thinking"),
  ).length;

  const handleSaveDesc = async (val: string) => {
    const trimmed = val.trim();
    setEditingDesc(false);
    if (trimmed === project.meta.description) return;
    await updateMut.mutateAsync({ id, patch: { meta: { description: trimmed } } });
  };

  const handleCopyPath = () => {
    void navigator.clipboard.writeText(project.meta.cwd ?? project.meta.name);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1500);
  };

  const handleSaveMemory = async () => {
    if (!memoryDirty) return;
    setMemorySaving(true);
    try {
      await updateMut.mutateAsync({ id, patch: { memory: memValue } });
      setMemoryDirty(false);
    } finally {
      setMemorySaving(false);
    }
  };

  const handleDiscardMemory = () => {
    setMemoryOverride(project.memory);
    setMemoryDirty(false);
  };

  const handleExport = async () => {
    const blob = await exportProject(id, includeHistory).catch(() => null);
    if (!blob) return;
    const project = projectQ.data;
    const slug = project
      ? project.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : "project";
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${slug}-agent-office.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const data = await importState(json);
      setImportStatus({ ok: true, msg: t("project_detail.import_success", { count: data.agentCount }) });
    } catch (err) {
      const msg = err instanceof ApiError
        ? ((err.data?.detail as string | undefined) ?? err.message)
        : String(err);
      setImportStatus({ ok: false, msg });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDangerConfirm = async () => {
    if (!pendingDanger) return;
    setDangerWorking(true);
    try {
      if (pendingDanger === "delete") {
        await apiFetch(API_ROUTES.project(id), { method: "DELETE" });
        router.push("/");
      } else if (pendingDanger === "reset") {
        for (const inst of project.meta.roster) {
          await apiFetch(API_ROUTES.projectRosterItem(id, inst.instanceId), { method: "DELETE" });
        }
        await projectQ.refetch();
        setPendingDanger(null);
      }
    } finally {
      setDangerWorking(false);
    }
  };

  return (
    <>
      {header}
      <AddAgentModal open={addOpen} projectId={id} onClose={() => setAddOpen(false)} />
      <PlanetEditorModal
        open={planetEditorOpen}
        projectId={id}
        current={project?.meta.planet}
        onSave={(cfg) => { void updateMut.mutateAsync({ id, patch: { meta: { planet: cfg } } }); }}
        onClose={() => setPlanetEditorOpen(false)}
      />
    <div className="overflow-auto p-0 overflow-hidden flex flex-col">
      {/* ps-body */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col px-[28px] pt-[22px] pb-[48px] gap-[16px] [&>*]:shrink-0">

        {/* HERO */}
        <div className="relative overflow-hidden border border-line bg-bg-1 rounded-lg">
          {/* Ambient gradient using avatar color */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 80% at 100% 0%, rgba(90,139,111,0.18) 0%, transparent 70%)" }} />

          <div className="relative z-[1] p-[24px_26px]">
            {/* Top row */}
            <div className="flex items-start gap-[18px]">
              <button
                type="button"
                onClick={() => setPlanetEditorOpen(true)}
                title="Change planet"
                className="relative shrink-0 group cursor-pointer border-0 bg-transparent p-0"
                style={{ width: 56, height: 56 }}
              >
                <PlanetCanvas
                  projectId={id}
                  config={project.meta.planet}
                  size={56}
                  className="rounded-full overflow-hidden"
                />
                <span className="absolute inset-0 rounded-full flex items-center justify-center bg-[rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <Icon name="edit" size={16} className="text-white" />
                </span>
              </button>
              <div className="flex-1 min-w-0 pt-[2px]">
                <div className="flex items-center gap-[10px] flex-wrap">
                  <h2 className="font-bold m-0 text-[20px] tracking-[-0.01em] text-txt">{project.meta.name}</h2>
                  {projectWorkingCount > 0 && (
                    <span className="inline-flex items-center gap-[5px] px-[8px] py-[2px] rounded-full text-[10px] font-semibold font-[var(--font-mono)] tracking-[0.03em] text-status-working" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                      <span className="w-[5px] h-[5px] rounded-full animate-pulse bg-status-working" />
                      {projectWorkingCount} active
                    </span>
                  )}
                </div>
                {editingDesc ? (
                  <input
                    autoFocus
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    onBlur={(e) => { void handleSaveDesc(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); void handleSaveDesc(descValue); }
                      if (e.key === "Escape") { setEditingDesc(false); }
                    }}
                    placeholder="Add a description…"
                    className="mt-[5px] w-full bg-transparent border-0 outline-none text-[13px] text-txt leading-[1.5] placeholder:text-txt-4 focus:shadow-[0_1px_0_0_rgba(255,255,255,0.15)]"
                  />
                ) : (
                  <p
                    className="m-0 mt-[5px] text-[13px] text-txt-3 leading-[1.5] cursor-text hover:text-txt-2 transition-colors"
                    title="Click to edit description"
                    onClick={() => { setDescValue(project.meta.description); setEditingDesc(true); }}
                  >
                    {project.meta.description || <span className="italic opacity-50">{t("project_detail.no_description")}</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-0 mt-[20px] pt-[16px] border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex items-baseline gap-[5px] pr-[20px]">
                <span className="text-[22px] font-bold text-txt tabular-nums leading-none">{rosterCount}</span>
                <span className="text-[11px] text-txt-3 font-[var(--font-mono)]">agents</span>
              </div>
              {projectWorkingCount > 0 && (
                <div className="flex items-baseline gap-[5px] px-[20px] border-l border-[rgba(255,255,255,0.06)] text-status-working">
                  <span className="text-[22px] font-bold tabular-nums leading-none">{projectWorkingCount}</span>
                  <span className="text-[11px] font-[var(--font-mono)] opacity-70">working</span>
                </div>
              )}
              {(project.runCount ?? 0) > 0 && (
                <div className="flex items-baseline gap-[5px] px-[20px] border-l border-[rgba(255,255,255,0.06)]">
                  <span className="text-[22px] font-bold text-txt tabular-nums leading-none">{project.runCount}</span>
                  <span className="text-[11px] text-txt-3 font-[var(--font-mono)]">runs</span>
                </div>
              )}
              <div className="flex items-end gap-[14px] ml-auto flex-col items-end">
                <div className="flex items-center gap-[14px]">
                  {project.lastRunAt && (
                    <span className="font-[var(--font-mono)] text-[10.5px] text-txt-3">
                      last run {relativeTime(project.lastRunAt)}
                    </span>
                  )}
                  {project.meta.cwd && (
                    <div className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3">
                      <Icon name="folder" size={11} className="shrink-0" />
                      <span className="truncate max-w-[360px]">
                        {project.meta.cwd.replace(/^\/home\/[^/]+\//, "~/")}
                      </span>
                      <button type="button" className="shrink-0 w-[20px] h-[20px] grid place-items-center rounded-[4px] bg-transparent border-none text-txt-3 hover:bg-bg-3 hover:text-txt cursor-pointer transition-colors" title="Copy path" onClick={handleCopyPath}>
                        <Icon name={copiedPath ? "check" : "copy"} size={11} />
                      </button>
                    </div>
                  )}
                </div>
                {gitStatusQ.data?.isGit && (
                  <div className="flex items-center gap-[10px] font-[var(--font-mono)] text-[10.5px] text-txt-3">
                    {gitStatusQ.data.branch && (
                      <span className="flex items-center gap-[5px]">
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                          <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z" />
                        </svg>
                        {gitStatusQ.data.branch}
                      </span>
                    )}
                    {(gitStatusQ.data.added > 0 || gitStatusQ.data.removed > 0) && (
                      <span className="flex items-center gap-[4px]">
                        {gitStatusQ.data.added > 0 && (
                          <span className="text-status-working">+{gitStatusQ.data.added}</span>
                        )}
                        {gitStatusQ.data.removed > 0 && (
                          <span className="text-status-error">-{gitStatusQ.data.removed}</span>
                        )}
                      </span>
                    )}
                    {gitStatusQ.data.behind > 0 && (
                      <span className="flex items-center gap-[3px] text-[var(--warn,#e6b35a)]">
                        ↓ {gitStatusQ.data.behind} behind
                      </span>
                    )}
                    {gitStatusQ.data.ahead > 0 && (
                      <span className="flex items-center gap-[3px] text-status-working">
                        ↑ {gitStatusQ.data.ahead} ahead
                      </span>
                    )}
                    {gitStatusQ.data.added === 0 && gitStatusQ.data.removed === 0 && gitStatusQ.data.behind === 0 && gitStatusQ.data.ahead === 0 && (
                      <span className="text-txt-4">clean</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVITY */}
        <section className="bg-bg-1 border border-line overflow-hidden rounded-lg">
          <div className="flex items-center border-b border-line gap-[12px] px-[18px] py-[12px]">
            <div className="grid place-items-center bg-bg-2 border border-line text-txt-2 shrink-0 w-[28px] h-[28px] rounded-[7px]"><Icon name="zap" size={14} /></div>
            <div className="flex-1 min-w-0">
              <h3 className="flex items-center font-bold text-txt m-0 text-[13px] gap-[8px]">Activity</h3>
              <div className="text-txt-3 font-[var(--font-mono)] text-[10.5px] mt-[2px]">recent runs for this project</div>
            </div>
          </div>
          <ProjectActivity projectId={id} />
        </section>

        {/* MEMORY */}
        <section className="bg-bg-1 border border-line overflow-hidden rounded-lg">
          <div className="flex items-center border-b border-line gap-[12px] px-[18px] py-[12px]">
            <div className="grid place-items-center bg-bg-2 border border-line text-txt-2 shrink-0 w-[28px] h-[28px] rounded-[7px]"><Icon name="memory" size={14} /></div>
            <div className="flex-1 min-w-0">
              <h3 className="flex items-center font-bold text-txt m-0 text-[13px] gap-[8px]">{t("project_detail.memory_card_title")}</h3>
              <div className="text-txt-3 font-[var(--font-mono)] text-[10.5px] mt-[2px]">{t("project_detail.memory_card_sub", { project: project.meta.name })}</div>
            </div>
          </div>
          <div className="px-[18px] pt-[14px] pb-[4px] flex flex-col gap-[10px]">
            <CodeEditor
              value={memValue}
              onChange={(v) => { setMemoryOverride(v); setMemoryDirty(true); }}
              placeholder={t("project_detail.memory_placeholder")}
              minHeight={200}
            />
            <div className="flex items-center gap-[12px] px-[2px] py-[8px]">
              {memoryDirty ? (
                <span className="inline-flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-status-queued">
                  <span className="rounded-full w-[5px] h-[5px] bg-status-queued" style={{ boxShadow: "0 0 5px var(--queued)" }} />
                  unsaved changes
                </span>
              ) : (
                <span className="text-[11.5px] text-txt-3 font-mono">
                  {memorySaving ? "Saving…" : "saved"}
                </span>
              )}
              <div className="ml-auto flex gap-[6px]">
                {memoryDirty && (
                  <Button variant="ghost" size="sm" onClick={handleDiscardMemory}>
                    Discard
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSaveMemory()}
                  disabled={!memoryDirty || memorySaving}
                >
                  <Icon name="check" size={12} />
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* BACKUP */}
        <section className="bg-bg-1 border border-line overflow-hidden rounded-lg">
          <div className="flex items-center border-b border-line gap-[12px] px-[18px] py-[12px]">
            <div className="grid place-items-center bg-bg-2 border border-line text-txt-2 shrink-0 w-[28px] h-[28px] rounded-[7px]"><Icon name="archive" size={14} /></div>
            <div className="flex-1 min-w-0">
              <h3 className="flex items-center font-bold text-txt m-0 text-[13px] gap-[8px]">Backup &amp; portability</h3>
              <div className="text-txt-3 font-[var(--font-mono)] text-[10.5px] mt-[2px]">export this project as a portable JSON file, or import another</div>
            </div>
          </div>
          <div className="px-[18px] py-[14px]">
            <div className="grid gap-[10px] [grid-template-columns:1fr_1fr] max-[800px]:[grid-template-columns:1fr]">
              <div className="flex flex-col bg-bg-2 border border-line gap-[10px] px-[16px] py-[14px] rounded-md">
                <div className="flex items-center gap-[10px]">
                  <div className="grid place-items-center bg-bg-2 border border-line text-txt-2 shrink-0 w-[32px] h-[32px] rounded-[8px]"><Icon name="download" size={14} /></div>
                  <div>
                    <div className="font-bold text-txt text-[13px]">{t("project_detail.save_card_title")}</div>
                    <div className="text-txt-3 font-[var(--font-mono)] text-[10.5px] mt-[1px]">→ {project.meta.name}.agent-office.json</div>
                  </div>
                </div>
                <label className={cn("flex items-center bg-bg-1 border border-line text-txt-2 cursor-pointer gap-[8px] px-[10px] py-[6px] rounded-[8px] text-[12px] transition-[border-color] duration-[100ms] hover:[border-color:var(--line-2)]", includeHistory && "ps-backup-opt-on")}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={includeHistory}
                    onChange={(e) => setIncludeHistory(e.target.checked)}
                  />
                  <span className={cn("grid place-items-center bg-bg-0 shrink-0 w-[16px] h-[16px] border rounded-[4px]", includeHistory ? "bg-acc text-white border-acc" : "border-line-2 text-transparent")}>
                    <Icon name="check" size={10} />
                  </span>
                  {t("project_detail.save_include_history")}
                </label>
                <div className="flex gap-[8px]">
                  <Button variant="primary" size="sm" onClick={handleExport}>
                    <Icon name="download" size={12} />
                    {t("project_detail.save_export_button")}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col bg-bg-2 border border-line gap-[10px] px-[16px] py-[14px] rounded-md">
                <div className="flex items-center gap-[10px]">
                  <div className="grid place-items-center bg-bg-2 border border-line text-txt-2 shrink-0 w-[32px] h-[32px] rounded-[8px]"><Icon name="upload" size={14} /></div>
                  <div>
                    <div className="font-bold text-txt text-[13px]">Import project</div>
                    <div className="text-txt-3 font-[var(--font-mono)] text-[10.5px] mt-[1px]">restore a .agent-office.json save file</div>
                  </div>
                </div>
                <div
                  className="flex flex-col items-center justify-center bg-bg-1 text-txt-3 gap-[6px] py-[20px] rounded-[8px] font-[var(--font-mono)] text-[11.5px] cursor-pointer border border-dashed border-line-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="upload" size={18} />
                  <span>drop a save file here, or click to browse</span>
                </div>
                {importStatus && (
                  <span className={`text-xs ${importStatus.ok ? "text-status-done" : "text-status-error"}`}>
                    {importStatus.msg}
                  </span>
                )}
                <div className="flex gap-[8px]">
                  <Button
                    size="sm"
                    disabled={importing}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="folder" size={12} />
                    {importing ? t("common.loading") : t("project_detail.save_import_button")}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => void handleImport(e)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section className="overflow-hidden rounded-lg" style={{ border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.03)" }}>
          <div className="flex items-center gap-[12px] px-[18px] py-[12px] border-b border-b-[rgba(239,68,68,0.18)]">
            <div className="grid place-items-center shrink-0 w-[28px] h-[28px] rounded-[7px] border text-status-error" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}><Icon name="shield" size={14} /></div>
            <div className="flex-1 min-w-0">
              <h3 className="flex items-center font-bold m-0 text-[13px] gap-[8px] text-status-error">Danger zone</h3>
              <div className="text-txt-3 font-[var(--font-mono)] text-[10.5px] mt-[2px]">destructive actions - they cannot be undone</div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-[14px] px-[18px] py-[12px]" style={{ borderTop: "0" }}>
              <div className="flex-1">
                <div className="font-semibold text-txt text-[13px]">Reset roster</div>
                <div className="text-txt-3 font-[var(--font-mono)] text-[11px] mt-[2px]">
                  remove all {rosterCount} agents from the office - agent definitions stay in ~/.claude/agents/
                </div>
              </div>
              {pendingDanger === "reset" ? (
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-txt-3">Are you sure?</span>
                  <Button variant="ghost" size="sm" onClick={() => setPendingDanger(null)} disabled={dangerWorking}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void handleDangerConfirm()} disabled={dangerWorking}>
                    {dangerWorking ? "…" : "Reset"}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setPendingDanger("reset")}
                  disabled={rosterCount === 0}
                >
                  <Icon name="refresh" size={12} />
                  Reset roster
                </Button>
              )}
            </div>

            <div className="flex items-center gap-[14px] px-[18px] py-[12px]" style={{ borderTop: "1px solid rgba(239,68,68,0.10)" }}>
              <div className="flex-1">
                <div className="font-semibold text-txt text-[13px]">Delete project</div>
                <div className="text-txt-3 font-[var(--font-mono)] text-[11px] mt-[2px]">
                  remove the workspace entry and all conversation history - files at {project.meta.cwd ?? project.meta.name} stay untouched
                </div>
              </div>
              {pendingDanger === "delete" ? (
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-txt-3">Are you sure?</span>
                  <Button variant="ghost" size="sm" onClick={() => setPendingDanger(null)} disabled={dangerWorking}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void handleDangerConfirm()} disabled={dangerWorking}>
                    {dangerWorking ? "…" : "Delete"}
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setPendingDanger("delete")}>
                  <Icon name="trash" size={12} />
                  Delete project
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
    </>
  );
}
