"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { useProject, useRemoveInstance, useUpdateProject } from "../hooks/use-projects";
import { useOfficeStore } from "@/modules/office/hooks/use-office-store";
import { ProjectActivity } from "./project-activity";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { useRouter } from "next/navigation";

function BroadcastModal({ projectId, rosterCount, onClose }: { projectId: string; rosterCount: number; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ broadcastId: string; runIds: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch<{ broadcastId: string; runIds: string[] }>(
        API_ROUTES.broadcast,
        { method: "POST", body: { projectId, prompt: prompt.trim() } },
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Broadcast to roster"
        style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, width: 520, maxWidth: "calc(100vw - 48px)", display: "flex", flexDirection: "column", gap: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Broadcast to roster</div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 2 }}>
              Sends the same prompt to all {rosterCount} agents simultaneously
            </div>
          </div>
          <button type="button" className="btn sm ghost" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        {result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: "var(--done)", fontWeight: 600 }}>
              Broadcast sent — {result.runIds.length} runs started
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)", display: "flex", flexDirection: "column", gap: 3 }}>
              {result.runIds.map((rid) => <span key={rid}>{rid.slice(0, 20)}…</span>)}
            </div>
            <button type="button" className="btn sm" onClick={onClose} style={{ alignSelf: "flex-end" }}>Close</button>
          </div>
        ) : (
          <>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type the prompt to broadcast to all agents…"
              rows={5}
              autoFocus
              style={{ width: "100%", resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12.5, padding: "8px 10px", background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--txt)", boxSizing: "border-box" }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void handleSend(); }
              }}
            />
            {error && <div style={{ fontSize: 12, color: "var(--error)" }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={onClose} disabled={sending}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => void handleSend()} disabled={sending || !prompt.trim()}>
                <Icon name="send" size={13} />
                {sending ? "Sending…" : `Send to ${rosterCount} agents`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export type ProjectDetailProps = { id: string };

export function ProjectDetail({ id }: ProjectDetailProps) {
  const t = useTranslations();
  const router = useRouter();
  const projectQ = useProject(id);
  const updateMut = useUpdateProject();
  const removeMut = useRemoveInstance();
  const openChat = useOfficeStore((s) => s.select);

  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const [memoryOverride, setMemoryOverride] = useState<string | null>(null);
  const [memoryDirty, setMemoryDirty] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);

  const [includeHistory, setIncludeHistory] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [copiedPath, setCopiedPath] = useState(false);
  const [pendingDanger, setPendingDanger] = useState<"reset" | "delete" | null>(null);
  const [dangerWorking, setDangerWorking] = useState(false);

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
  const memValue = memoryOverride ?? project.memory;
  const rosterCount = project.meta.roster.length;
  const initials = project.meta.name.slice(0, 2).toUpperCase();

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

  const handleExport = () => {
    const url = `/api/save/export?projectId=${encodeURIComponent(id)}${includeHistory ? "&history=1" : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const res = await fetch("/api/save/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json() as { agentCount?: number; detail?: string; error?: string };
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
    <div className="tab-pane" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {broadcastOpen && (
        <BroadcastModal
          projectId={id}
          rosterCount={rosterCount}
          onClose={() => setBroadcastOpen(false)}
        />
      )}

      <div className="ps-body">
        {/* HERO */}
        <div className="ps-hero">
          <div className="av">{initials}</div>
          <div className="titles">
            <h2>
              {project.meta.name}
              <span className="live-badge"><span className="d" /> active</span>
            </h2>
            {project.meta.cwd && (
              <div className="path">
                <Icon name="folder" size={11} />
                <code>{project.meta.cwd}</code>
                <button type="button" className="copy" title="Copy path" onClick={handleCopyPath}>
                  <Icon name={copiedPath ? "check" : "copy"} size={11} />
                </button>
              </div>
            )}
            <div className="desc">
              {project.meta.description || t("project_detail.no_description")}
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="l">Agents</div>
              <div className="v">{rosterCount}</div>
            </div>
          </div>
        </div>

        {/* ACTIVITY */}
        <section className="ps-section">
          <div className="ps-section-head">
            <div className="ico"><Icon name="zap" size={14} /></div>
            <div className="titles">
              <h3>Activity</h3>
              <div className="sub">recent runs for this project</div>
            </div>
          </div>
          <div className="ps-section-body" style={{ padding: 0 }}>
            <ProjectActivity projectId={id} />
          </div>
        </section>

        {/* ROSTER */}
        <section className="ps-section">
          <div className="ps-section-head">
            <div className="ico"><Icon name="users" size={14} /></div>
            <div className="titles">
              <h3>
                Roster
                <span className="pip">{rosterCount} agents</span>
              </h3>
              <div className="sub">summoned into this project · click any to chat</div>
            </div>
            {rosterCount > 0 && (
              <div className="actions">
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => setBroadcastOpen(true)}
                  title="Send the same prompt to all agents simultaneously"
                >
                  <Icon name="send" size={12} />
                  Broadcast
                </button>
              </div>
            )}
          </div>
          <div className="ps-section-body">
            {rosterCount === 0 ? (
              <div style={{ fontSize: 13, color: "var(--txt-3)" }}>
                {t("project_detail.roster_empty")}
              </div>
            ) : (
              <div className="ps-roster">
                {project.meta.roster.map((inst) => (
                  <div key={inst.instanceId} className="ps-roster-row">
                    <div className="av" style={{ display: "grid", placeItems: "center", color: "var(--txt-3)" }}>
                      <Icon name="users" size={16} />
                    </div>
                    <div className="info">
                      <div className="name">{inst.label ?? inst.agentId}</div>
                      <div className="sub">
                        {inst.model && <><span style={{ color: "var(--txt-2)" }}>{inst.model}</span><span className="sep">·</span></>}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{inst.instanceId}</span>
                      </div>
                    </div>
                    <div className="ps-rr-acts">
                      {pendingRemoveId === inst.instanceId ? (
                        <>
                          <span style={{ fontSize: 11.5, color: "var(--txt-3)", whiteSpace: "nowrap" }}>Remove?</span>
                          <button type="button" className="btn sm ghost" style={{ width: "auto", padding: "0 8px" }} onClick={() => setPendingRemoveId(null)}>
                            {t("common.cancel")}
                          </button>
                          <button
                            type="button"
                            className="btn sm danger"
                            style={{ width: "auto", padding: "0 8px" }}
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
                            className="chat"
                            title={t("project_detail.chat_button")}
                            onClick={() => openChat(inst.agentId, { instanceId: inst.instanceId })}
                          >
                            <Icon name="send" size={13} />
                          </button>
                          <button
                            type="button"
                            className="remove"
                            title={t("project_detail.remove_title")}
                            onClick={() => setPendingRemoveId(inst.instanceId)}
                          >
                            <Icon name="x" size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* MEMORY */}
        <section className="ps-section">
          <div className="ps-section-head">
            <div className="ico"><Icon name="memory" size={14} /></div>
            <div className="titles">
              <h3>{t("project_detail.memory_card_title")}</h3>
              <div className="sub">{t("project_detail.memory_card_sub", { project: project.meta.name })}</div>
            </div>
          </div>
          <div className="ps-section-body" style={{ padding: 0 }}>
            <div className="ps-memory">
              <div className="ps-memory-toolbar">
                <span className="tag">markdown</span>
                <span className="right">
                  {memValue.length.toLocaleString()} chars · ~{Math.round(memValue.length / 4)} tokens
                </span>
              </div>
              <textarea
                value={memValue}
                onChange={(e) => { setMemoryOverride(e.target.value); setMemoryDirty(true); }}
                placeholder={t("project_detail.memory_placeholder")}
                rows={10}
              />
              <div className="ps-memory-foot">
                {memoryDirty ? (
                  <span className="dirty">
                    <span className="led" />
                    unsaved changes
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>
                    {memorySaving ? "Saving…" : "saved"}
                  </span>
                )}
                <div className="actions">
                  {memoryDirty && (
                    <button type="button" className="btn sm ghost" onClick={handleDiscardMemory}>
                      Discard
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() => void handleSaveMemory()}
                    disabled={!memoryDirty || memorySaving}
                  >
                    <Icon name="check" size={12} />
                    {t("common.save")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BACKUP */}
        <section className="ps-section">
          <div className="ps-section-head">
            <div className="ico"><Icon name="archive" size={14} /></div>
            <div className="titles">
              <h3>Backup &amp; portability</h3>
              <div className="sub">export this project as a portable JSON file, or import another</div>
            </div>
          </div>
          <div className="ps-section-body">
            <div className="ps-backup">
              <div className="ps-backup-card">
                <div className="head">
                  <div className="ico"><Icon name="download" size={14} /></div>
                  <div className="titles">
                    <div className="title">{t("project_detail.save_card_title")}</div>
                    <div className="sub">→ {project.meta.name}.agent-office.json</div>
                  </div>
                </div>
                <label className={`opt-row${includeHistory ? " on" : ""}`} style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={{ display: "none" }}
                    checked={includeHistory}
                    onChange={(e) => setIncludeHistory(e.target.checked)}
                  />
                  <span className="checkbox"><Icon name="check" size={10} /></span>
                  {t("project_detail.save_include_history")}
                </label>
                <div className="foot">
                  <button type="button" className="btn sm primary" onClick={handleExport}>
                    <Icon name="download" size={12} />
                    {t("project_detail.save_export_button")}
                  </button>
                </div>
              </div>

              <div className="ps-backup-card">
                <div className="head">
                  <div className="ico"><Icon name="upload" size={14} /></div>
                  <div className="titles">
                    <div className="title">Import project</div>
                    <div className="sub">restore a .agent-office.json save file</div>
                  </div>
                </div>
                <div
                  className="drop-zone"
                  style={{ cursor: "pointer" }}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="upload" size={18} />
                  <span>drop a save file here, or click to browse</span>
                </div>
                {importStatus && (
                  <span style={{ fontSize: 12, color: importStatus.ok ? "var(--done)" : "var(--error)" }}>
                    {importStatus.msg}
                  </span>
                )}
                <div className="foot">
                  <button
                    type="button"
                    className="btn sm"
                    disabled={importing}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="folder" size={12} />
                    {importing ? t("common.loading") : t("project_detail.save_import_button")}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: "none" }}
                    onChange={(e) => void handleImport(e)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section className="ps-section ps-danger">
          <div className="ps-section-head">
            <div className="ico"><Icon name="shield" size={14} /></div>
            <div className="titles">
              <h3>Danger zone</h3>
              <div className="sub">destructive actions — they cannot be undone</div>
            </div>
          </div>
          <div>
            <div className="ps-danger-row">
              <div className="info">
                <div className="t">Reset roster</div>
                <div className="d">
                  remove all {rosterCount} agents from the office — agent definitions stay in ~/.claude/agents/
                </div>
              </div>
              {pendingDanger === "reset" ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--txt-3)" }}>Are you sure?</span>
                  <button type="button" className="btn sm ghost" onClick={() => setPendingDanger(null)} disabled={dangerWorking}>
                    Cancel
                  </button>
                  <button type="button" className="btn sm danger" onClick={() => void handleDangerConfirm()} disabled={dangerWorking}>
                    {dangerWorking ? "…" : "Reset"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setPendingDanger("reset")}
                  disabled={rosterCount === 0}
                >
                  <Icon name="refresh" size={12} />
                  Reset roster
                </button>
              )}
            </div>

            <div className="ps-danger-row">
              <div className="info">
                <div className="t">Delete project</div>
                <div className="d">
                  remove the workspace entry and all conversation history — files at {project.meta.cwd ?? project.meta.name} stay untouched
                </div>
              </div>
              {pendingDanger === "delete" ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--txt-3)" }}>Are you sure?</span>
                  <button type="button" className="btn sm ghost" onClick={() => setPendingDanger(null)} disabled={dangerWorking}>
                    Cancel
                  </button>
                  <button type="button" className="btn sm danger" onClick={() => void handleDangerConfirm()} disabled={dangerWorking}>
                    {dangerWorking ? "…" : "Delete"}
                  </button>
                </div>
              ) : (
                <button type="button" className="btn sm danger" onClick={() => setPendingDanger("delete")}>
                  <Icon name="trash" size={12} />
                  Delete project
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
