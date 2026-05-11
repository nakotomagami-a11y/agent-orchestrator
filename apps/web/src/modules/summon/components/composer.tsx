"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";

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

export type ComposerProps = {
  disabled?: boolean;
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  abortable?: boolean;
  /** Shown as a chip in the toolbar (e.g. "haiku"). */
  modelChip?: string;
  /** Shown as a chip in the toolbar (e.g. "cwd: ~/proj"). */
  cwdChip?: string;
  /** Imperative seed (e.g. clicking a suggestion). */
  seed?: string;
  /** Triggered when user picks a slash command that maps to a UI action. */
  onCommand?: (cmd: string) => void;
};

export function Composer({
  disabled,
  onSubmit,
  onAbort,
  abortable,
  modelChip,
  cwdChip,
  seed,
  onCommand,
}: ComposerProps) {
  const t = useTranslations();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const send = () => {
    const v = value.trim();
    if (!v && attachments.length === 0) return;
    if (disabled) return;

    // Handle inline slash commands locally — never sent to the agent.
    if (v.startsWith("/")) {
      const [cmd] = v.split(/\s+/);
      if (cmd && SLASH_COMMANDS.some((s) => s.cmd === cmd) && onCommand) {
        onCommand(cmd);
        setValue("");
        setSlashOpen(false);
        return;
      }
    }

    const composed =
      attachments.length > 0 ? `${v}\n\n[attached: ${attachments.join(", ")}]`.trimStart() : v;
    onSubmit(composed);
    setValue("");
    setAttachments([]);
    setSlashOpen(false);
    autosize(textRef.current);
    textRef.current?.focus();
  };

  const insertSlash = (cmd: string) => {
    setValue(cmd + " ");
    setSlashOpen(false);
    textRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    setSlashOpen(next.startsWith("/"));
    setSlashIdx(0);
    autosize(textRef.current);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files.map((f) => f.name)]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="composer">
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

        <div className="composer-box">
          {attachments.length > 0 ? (
            <div className="composer-attachments">
              {attachments.map((name, i) => (
                <span key={`${name}-${i}`} className="attach-chip">
                  <Icon name="folder" size={11} /> {name}
                  <button
                    type="button"
                    className="x"
                    aria-label={t("composer.remove_chip_aria", { name })}
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
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
            placeholder={t("composer.input_placeholder")}
            aria-label={t("composer.input_aria")}
            rows={1}
          />
          <div className="composer-bar">
            <button
              type="button"
              className="btn sm ghost"
              title="Attach"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach file"
            >
              <Icon name="attach" />
            </button>
            <button
              type="button"
              className="btn sm ghost"
              title="Insert slash command"
              onClick={() => onChange("/")}
              aria-label="Insert slash command"
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
                  <span className="kbd">⏎</span> send · <span className="kbd">⇧⏎</span> newline
                </span>
              )}
              <button
                type="button"
                className="send-btn"
                onClick={send}
                disabled={disabled || (!value.trim() && attachments.length === 0)}
                aria-label="Send"
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
