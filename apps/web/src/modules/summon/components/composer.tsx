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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { useAgentPrompts } from "../hooks/use-agent-prompts";
import { clearDraft, loadDraft, saveDraft } from "../utils/draft-store";
import { isTauri } from "@/lib/tauri-window";
import type { ContextProfile } from "@agent-office/shared/types";

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
  /** Local id for React keying - not persisted. */
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
  /** Agent owning this chat - used as the default upload target. */
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
  /**
   * Key used to persist the draft server-side via /api/drafts so it survives
   * modal close/reopen cycles. Pass the same `transcriptKey(agentId, instanceId)`
   * value used by the chat panel. When omitted, drafts are not persisted.
   */
  draftKey?: string;
  contextProfile?: ContextProfile;
  onProfileChange?: (p: ContextProfile) => void;
};

let attachmentCounter = 0;
const nextAttachmentId = () => `att-${Date.now().toString(36)}-${attachmentCounter++}`;

const PROFILE_CYCLE: ContextProfile[] = ["tight", "balanced", "deep"];
const PROFILE_TOK: Record<ContextProfile, string> = {
  tight: "~400 tok",
  balanced: "~1.5k tok",
  deep: "~4k tok",
};

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
  draftKey,
  contextProfile = "balanced",
  onProfileChange,
}: ComposerProps) {
  const t = useTranslations();
  // Initialise empty; the persisted draft loads async in the effect below.
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

  // Resize the textarea on mount so a restored draft is fully visible
  // without the user having to interact with it first.
  useEffect(() => {
    autosize(textRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the persisted draft async on mount. draftKey is stable for the
  // lifetime of this Composer instance (key= remount on agent/instance change).
  useEffect(() => {
    if (!draftKey) return;
    loadDraft(draftKey).then((text) => {
      if (text) {
        setValue(text);
        autosize(textRef.current);
      }
    }).catch(() => { /* ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (seed !== undefined) {
      setValue(seed);
      if (draftKey) void saveDraft(draftKey, seed);
      textRef.current?.focus();
      autosize(textRef.current);
    }
  // draftKey is stable for the lifetime of this Composer instance (it changes
  // only via key= remount), so it's safe to omit from the array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (isTauri()) {
      const items = Array.from(e.clipboardData.items);
      const hasText = items.some((item) => item.kind === "string");
      if (!hasText) {
        // Image paste in Tauri: clipboardData is empty due to WebKit2GTK's clipboard
        // isolation. Read the image directly from the Wayland compositor via wl-paste.
        e.preventDefault();
        void fetch("/api/clipboard-image", { method: "POST" })
          .then(async (res) => {
            if (!res.ok) return;
            const blob = await res.blob();
            if (blob.size > 100) {
              const ext = (blob.type || "image/png").split("/")[1] ?? "png";
              void uploadOne(new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type || "image/png" }));
            }
          })
          .catch(() => {});
      }
      // Text paste: let default textarea behaviour handle it.
      return;
    }
    // Browser (Chromium): clipboardData is populated normally.
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) {
          const ext = f.type.split("/")[1] ?? "png";
          files.push(new File([f], `pasted-${Date.now()}.${ext}`, { type: f.type }));
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      for (const file of files) void uploadOne(file);
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
        // Slash commands are UI actions - clear the draft too.
        if (draftKey) void clearDraft(draftKey);
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
    // Draft has been sent - clear it so it doesn't reappear on reopen.
    if (draftKey) void clearDraft(draftKey);
    setValue("");
    setAttachments([]);
    setSlashOpen(false);
    setPromptsOpen(false);
    // Clear the DOM value before autosize so scrollHeight reflects the empty state,
    // not the stale pre-render value (React batches the setValue update).
    if (textRef.current) textRef.current.value = "";
    autosize(textRef.current);
    textRef.current?.focus();
  };

  // Route through onChange so the draft store stays in sync.
  const insertSlash = (cmd: string) => {
    onChange(cmd + " ");
    setSlashOpen(false);
    setPromptsOpen(false);
    textRef.current?.focus();
  };

  const selectPrompt = (body: string) => {
    onChange(body);
    setPromptsOpen(false);
    setSlashOpen(false);
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
    if (draftKey) void saveDraft(draftKey, next);
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
      className="bg-bg-1 px-[24px] pt-[12px] pb-[18px]"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="max-w-[760px] mx-auto relative">
        {slashOpen && filteredSlash.length > 0 ? (
          <div className="absolute bg-[var(--bg-1)] border border-[var(--line)] bottom-[calc(100%+8px)] left-[24px] right-[24px] max-w-[380px] rounded-[10px] shadow-[0_2px_6px_rgba(40,30,25,0.06),0_8px_24px_rgba(40,30,25,0.08)] p-1 z-[20]" role="listbox" aria-label="Slash commands">
            {filteredSlash.map((s, i) => (
              <button
                key={s.cmd}
                type="button"
                role="option"
                aria-selected={i === slashIdx}
                className={cn(
                  "cursor-pointer flex items-center gap-[10px] px-[10px] py-2 rounded-[6px] w-full",
                  i === slashIdx ? "bg-[var(--bg-2)]" : "hover:bg-[var(--bg-2)]",
                )}
                onMouseEnter={() => setSlashIdx(i)}
                onClick={() => insertSlash(s.cmd)}
              >
                <span className="text-[var(--acc)] font-semibold font-[var(--font-mono)] text-[12px]">{s.cmd}</span>
                <span className="text-[var(--txt-2)] text-[12px]">{t(s.descKey)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {promptsOpen ? (
          <div
            className="absolute bg-[var(--bg-1)] border border-[var(--line)] bottom-[calc(100%+8px)] left-0 right-0 max-w-full max-h-[200px] rounded-[10px] shadow-[0_2px_6px_rgba(40,30,25,0.06),0_8px_24px_rgba(40,30,25,0.08)] p-1 z-[20] overflow-y-auto"
            role="listbox"
            aria-label={t("composer.saved_prompts_aria")}
          >
            {filteredPrompts.length === 0 ? (
              <div className="text-txt-3 px-3 py-[10px] text-[12px]">
                {t("composer.saved_prompts_empty")}
              </div>
            ) : (
              filteredPrompts.map((p, i) => (
                <button
                  key={p.body}
                  type="button"
                  role="option"
                  aria-selected={i === promptsIdx}
                  className={cn(
                    "cursor-pointer flex flex-col items-start gap-0.5 px-[10px] py-2 rounded-[6px] w-full",
                    i === promptsIdx ? "bg-[var(--bg-2)]" : "hover:bg-[var(--bg-2)]",
                  )}
                  onMouseEnter={() => setPromptsIdx(i)}
                  onClick={() => selectPrompt(p.body)}
                >
                  <span className="font-semibold text-txt text-[12px]">{p.title}</span>
                  <span className="text-[var(--txt-2)] text-[12px]">
                    {p.body.length > 60 ? p.body.slice(0, 57) + "…" : p.body}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        <div
          className={"bg-bg-1 border-[1.5px] border-line-2 rounded-[16px] [box-shadow:var(--shadow-1)] transition-[border-color] duration-[160ms] focus-within:border-[var(--acc)]" + (dragOver ? " drag-over" : "")}
          aria-label={dragOver ? t("composer.drop_to_attach") : undefined}
        >
          {dragOver ? (
            <div className="drag-overlay" aria-hidden>
              <Icon name="attach" size={20} />
              {t("composer.drop_to_attach")}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <div className="flex gap-[6px] px-[10px] pt-[8px] flex-wrap">
              {attachments.map((a) => (
                <span
                  key={a.localId}
                  className="attach-chip inline-flex items-center gap-[6px] bg-bg-2 border border-line rounded-full text-txt-2 px-[8px] py-[4px] text-[11.5px]"
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
                    <Icon name="refresh" size={11} className="[animation:spin_1s_linear_infinite]" />
                  ) : (
                    <Icon name={a.error ? "x" : "folder"} size={11} />
                  )}{" "}
                  {a.pending ? t("composer.uploading_label") : a.name}
                  <button
                    type="button"
                    className="bg-transparent border-none p-0 text-txt-3 cursor-pointer inline-flex items-center justify-center w-[14px] h-[14px] hover:text-[var(--error)]"
                    aria-label={t("composer.remove_chip_aria", { name: a.name })}
                    onClick={() =>
                      setAttachments((prev) => prev.filter((x) => x.localId !== a.localId))
                    }
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
            className="border-none bg-transparent resize-none text-txt w-full px-[14px] pt-[12px] pb-[6px] font-[inherit] text-[14px] leading-[1.55] outline-none min-h-[48px] max-h-[220px] placeholder:text-txt-4"
          />
          <div className="flex items-center gap-[4px] px-[8px] pb-[8px] pt-[6px]">
            <Button
              variant="ghost"
              size="sm"
              title={t("composer.attach_title")}
              onClick={() => fileRef.current?.click()}
              aria-label={t("composer.attach_title")}
            >
              <Icon name="attach" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title={t("composer.slash_insert_title")}
              onClick={() => onChange("/")}
              aria-label={t("composer.slash_insert_aria")}
            >
              <Icon name="slash" />
            </Button>
            {cwdChip ? <span className="inline-flex items-center gap-[5px] bg-bg-2 border border-line text-txt-2 rounded-full cursor-pointer px-[8px] py-[3px] text-[11.5px] font-[var(--font-mono)] hover:bg-bg-3" title="working directory">{cwdChip}</span> : null}
            {modelChip ? <span className="inline-flex items-center gap-[5px] bg-bg-2 border border-line text-txt-2 rounded-full cursor-pointer px-[8px] py-[3px] text-[11.5px] font-[var(--font-mono)] hover:bg-bg-3" title="active model">{modelChip}</span> : null}
            {onProfileChange ? (
              <button
                type="button"
                title="Context profile — click to cycle"
                onClick={() => {
                  const next = PROFILE_CYCLE[(PROFILE_CYCLE.indexOf(contextProfile) + 1) % PROFILE_CYCLE.length] ?? "balanced";
                  onProfileChange(next);
                }}
                className={cn(
                  "inline-flex items-center gap-[5px] rounded-full cursor-pointer px-[8px] py-[3px] text-[11.5px] font-[var(--font-mono)] transition-colors",
                  contextProfile === "balanced"
                    ? "bg-bg-2 border border-line text-txt-2 hover:bg-bg-3"
                    : "bg-acc-faint border border-acc-tint text-acc hover:bg-acc-softer",
                )}
              >
                ctx:{contextProfile} <span className="text-txt-4">{PROFILE_TOK[contextProfile]}</span>
              </button>
            ) : null}
            <div className="ml-auto flex items-center gap-[6px]">
              {abortable ? (
                <Button size="sm" onClick={onAbort}>
                  <Icon name="stop" /> {t("common.abort")}
                </Button>
              ) : (
                <span
                  className="text-[11px] text-[var(--txt-4)] font-mono"
                >
                  <span className="inline-block bg-bg-1 text-txt-2 px-[5px] py-[1px] border border-b-2 border-line-2 rounded font-mono text-[10.5px]">⏎</span> {t("composer.shortcut_send")} ·{" "}
                  <span className="inline-block bg-bg-1 text-txt-2 px-[5px] py-[1px] border border-b-2 border-line-2 rounded font-mono text-[10.5px]">⇧⏎</span> {t("composer.shortcut_newline")}
                </span>
              )}
              <button
                type="button"
                className="send-btn bg-acc text-white border-none inline-flex items-center justify-center cursor-pointer w-[32px] h-[32px] rounded-[10px] [box-shadow:0_1px_0_rgba(0,0,0,0.08),0_2px_6px_rgba(233,84,32,0.30)] hover:bg-[var(--acc-hover)] disabled:bg-bg-3 disabled:text-txt-3 disabled:cursor-not-allowed disabled:[box-shadow:none]"
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
