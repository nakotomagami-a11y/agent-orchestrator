"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { useAgentPrompts } from "../hooks/use-agent-prompts";

type SlashCommand = {
  cmd: string;
  descKey: string;
};

const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/clear", descKey: "composer.command_clear_desc" },
  { cmd: "/branch", descKey: "composer.command_branch_desc" },
  { cmd: "/memory", descKey: "composer.command_memory_desc" },
  { cmd: "/prompt", descKey: "composer.command_prompt_desc" },
  { cmd: "/history", descKey: "composer.command_history_desc" },
];

type Attachment = {
  /** Local id for React keying — not persisted. */
  localId: string;
  /** Display name (filename). */
  name: string;
  /** On-disk path returned by the upload endpoint; absent while pending. */
  path?: string;
  /** While true, upload is still in flight. */
  pending: boolean;
  /** Error message if upload failed. The chip stays visible so the user can dismiss it. */
  error?: string;
};

export type ComposerProps = {
  disabled?: boolean;
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  abortable?: boolean;
  /** Agent owning this chat — used as the default upload target. */
  agentId: string;
  /** When set, uploads go to the project's uploads dir instead of the agent's. */
  projectId?: string;
  /** Shown as a chip in the toolbar (e.g. "haiku"). */
  modelChip?: string;
  /** Shown as a chip in the toolbar (e.g. "cwd: ~/proj"). */
  cwdChip?: string;
  /** Imperative seed (e.g. clicking a suggestion). */
  seed?: string;
  /** Triggered when user picks a slash command that maps to a UI action. */
  onCommand?: (cmd: string) => void;
};

let attachmentCounter = 0;
const nextAttachmentId = () => `att-${Date.now().toString(36)}-${attachmentCounter++}`;

export function Composer({
  disabled,
  onSubmit,
  onAbort,
  abortable,
  agentId,
  projectId,
  modelChip,
  cwdChip,
  seed,
  onCommand,
}: ComposerProps) {
  const t = useTranslations();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [promptsIdx, setPromptsIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: savedPrompts = [] } = useAgentPrompts(agentId);

  useEffect(() => {
    if (seed !== undefined) {
      setValue(seed);
      textRef.current?.focus();
      autosize(textRef.current);
    }
  }, [seed]);

  const filteredSlash = useMemo(() => {
    if (!value.startsWith("/")) return [];
    const q = value.slice(1).toLowerCase();
    return SLASH_COMMANDS.filter((s) => s.cmd.slice(1).startsWith(q));
  }, [value]);

  const filteredPrompts = useMemo(() => {
    if (!value.startsWith("/")) return [];
    const q = value.slice(1).toLowerCase();
    if (!q) return savedPrompts;
    return savedPrompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
    );
  }, [value, savedPrompts]);

  const uploadOne = async (file: File): Promise<void> => {
    const localId = nextAttachmentId();
    setAttachments((prev) => [...prev, { localId, name: file.name, pending: true }]);
    try {
      const form = new FormData();
      form.append("file", file);
      const target = projectId
        ? API_ROUTES.projectUploads(projectId)
        : API_ROUTES.agentUploads(agentId);
      const res = await fetch(target, { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { filename: string; path: string; size: number };
      setAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId
            ? { ...a, pending: false, path: data.path, name: data.filename }
            : a,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId ? { ...a, pending: false, error: msg } : a,
        ),
      );
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the composer-inner container entirely.
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
      setDragOver(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      void uploadOne(file);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      void uploadOne(file);
    }
  };

  const send = () => {
    const v = value.trim();
    const ready = attachments.filter((a) => a.path);
    if (!v && ready.length === 0) return;
    if (disabled) return;
    if (attachments.some((a) => a.pending)) return;

    if (v.startsWith("/")) {
      const [cmd] = v.split(/\s+/);
      if (cmd && SLASH_COMMANDS.some((s) => s.cmd === cmd) && onCommand) {
        onCommand(cmd);
        setValue("");
        setSlashOpen(false);
        setPromptsOpen(false);
        return;
      }
    }

    const composed =
      ready.length > 0
        ? `${v}\n\n${t("composer.attachments_intro")}\n${ready.map((a) => `- ${a.path}`).join("\n")}`.trimStart()
        : v;
    onSubmit(composed);
    setValue("");
    setAttachments([]);
    setSlashOpen(false);
    setPromptsOpen(false);
    autosize(textRef.current);
    textRef.current?.focus();
  };

  const insertSlash = (cmd: string) => {
    setValue(cmd + " ");
    setSlashOpen(false);
    setPromptsOpen(false);
    textRef.current?.focus();
  };

  const selectPrompt = (body: string) => {
    setValue(body);
    setPromptsOpen(false);
    setSlashOpen(false);
    autosize(textRef.current);
    textRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Saved-prompts menu takes keyboard priority when open.
    if (promptsOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPromptsIdx((i) => Math.min(Math.max(filteredPrompts.length - 1, 0), i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPromptsIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && filteredPrompts.length > 0) {
        e.preventDefault();
        const picked = filteredPrompts[promptsIdx];
        if (picked) selectPrompt(picked.body);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPromptsOpen(false);
        setSlashOpen(false);
        return;
      }
    }

    if (slashOpen && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIdx((i) => Math.min(filteredSlash.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const picked = filteredSlash[slashIdx];
        if (picked) insertSlash(picked.cmd);
        return;
      }
      if (e.key === "Escape") {
        setSlashOpen(false);
        setPromptsOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onChange = (next: string) => {
    setValue(next);
    const triggersSlash = next.startsWith("/");
    setSlashOpen(triggersSlash);
    setSlashIdx(0);
    setPromptsOpen(triggersSlash);
    setPromptsIdx(0);
    autosize(textRef.current);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      void uploadOne(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const anyPending = attachments.some((a) => a.pending);
  const hasReadyAttachments = attachments.some((a) => a.path);
  const sendDisabled =
    disabled || anyPending || (!value.trim() && !hasReadyAttachments);

  return (
    <div
      className="composer"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="composer-inner" style={{ position: "relative" }}>
        {slashOpen && filteredSlash.length > 0 ? (
          <div className="slash-popup" role="listbox" aria-label="Slash commands">
            {filteredSlash.map((s, i) => (
              <button
                key={s.cmd}
                type="button"
                role="option"
                aria-selected={i === slashIdx}
                className={"item" + (i === slashIdx ? " on" : "")}
                onMouseEnter={() => setSlashIdx(i)}
                onClick={() => insertSlash(s.cmd)}
              >
                <span className="cmd">{s.cmd}</span>
                <span className="desc">{t(s.descKey)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {promptsOpen ? (
          <div
            className="slash-popup prompts-popup"
            role="listbox"
            aria-label={t("composer.saved_prompts_aria")}
          >
            {filteredPrompts.length === 0 ? (
              <div className="prompts-empty">
                {t("composer.saved_prompts_empty")}
              </div>
            ) : (
              filteredPrompts.map((p, i) => (
                <button
                  key={p.body}
                  type="button"
                  role="option"
                  aria-selected={i === promptsIdx}
                  className={"item" + (i === promptsIdx ? " on" : "")}
                  onMouseEnter={() => setPromptsIdx(i)}
                  onClick={() => selectPrompt(p.body)}
                >
                  <span className="prompt-title">{p.title}</span>
                  <span className="desc">
                    {p.body.length > 60 ? p.body.slice(0, 57) + "…" : p.body}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        <div
          className={"composer-box" + (dragOver ? " drag-over" : "")}
          aria-label={dragOver ? t("composer.drop_to_attach") : undefined}
        >
          {dragOver ? (
            <div className="drag-overlay" aria-hidden>
              <Icon name="attach" size={20} />
              {t("composer.drop_to_attach")}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <div className="composer-attachments">
              {attachments.map((a) => (
                <span
                  key={a.localId}
                  className="attach-chip"
                  title={a.error ? t("composer.upload_failed_title", { error: a.error }) : a.path ?? a.name}
                  style={
                    a.error
                      ? { borderColor: "var(--error)", color: "var(--error)" }
                      : a.pending
                        ? { opacity: 0.7 }
                        : undefined
                  }
                >
                  {a.pending ? (
                    <Icon name="refresh" size={11} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Icon name={a.error ? "x" : "folder"} size={11} />
                  )}{" "}
                  {a.pending ? t("composer.uploading_label") : a.name}
                  <button
                    type="button"
                    className="x"
                    aria-label={t("composer.remove_chip_aria", { name: a.name })}
                    onClick={() =>
                      setAttachments((prev) => prev.filter((x) => x.localId !== a.localId))
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      color: "inherit",
                      cursor: "pointer",
                      display: "inline-flex",
                    }}
                  >
                    <Icon name="x" size={10} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <textarea
            ref={textRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            onPaste={onPaste}
            placeholder={t("composer.input_placeholder")}
            aria-label={t("composer.input_aria")}
            rows={1}
          />
          <div className="composer-bar">
            <button
              type="button"
              className="btn sm ghost"
              title={t("composer.attach_title")}
              onClick={() => fileRef.current?.click()}
              aria-label={t("composer.attach_title")}
            >
              <Icon name="attach" />
            </button>
            <button
              type="button"
              className="btn sm ghost"
              title={t("composer.slash_insert_title")}
              onClick={() => onChange("/")}
              aria-label={t("composer.slash_insert_aria")}
            >
              <Icon name="slash" />
            </button>
            {cwdChip ? <span className="chip" title="working directory">{cwdChip}</span> : null}
            {modelChip ? <span className="chip" title="active model">{modelChip}</span> : null}
            <div className="right">
              {abortable ? (
                <button type="button" className="btn sm" onClick={onAbort}>
                  <Icon name="stop" /> {t("common.abort")}
                </button>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--txt-4)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span className="kbd">⏎</span> {t("composer.shortcut_send")} ·{" "}
                  <span className="kbd">⇧⏎</span> {t("composer.shortcut_newline")}
                </span>
              )}
              <button
                type="button"
                className="send-btn"
                onClick={send}
                disabled={sendDisabled}
                aria-label={t("composer.send_label")}
              >
                <Icon name="send" />
              </button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={onPickFile}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(220, el.scrollHeight) + "px";
}
