"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PROFILE_CYCLE, PROFILE_TOK } from "../format/composer-config";
import type { ContextProfile } from "@agent-office/domain/types";

export type ComposerToolbarProps = {
  cwdChip: string | undefined;
  modelChip: string | undefined;
  contextProfile: ContextProfile;
  onProfileChange: ((p: ContextProfile) => void) | undefined;
  abortable: boolean | undefined;
  onAbort: (() => void) | undefined;
  sendDisabled: boolean;
  onSend: () => void;
  onAttachClick: () => void;
  onSlashClick: () => void;
  onPromptPickerOpen: () => void;
};

/**
 * Bottom action bar of the composer — attach/slash/prompt buttons, context
 * profile chip, cwd/model chips, abort or send.
 */
export function ComposerToolbar(props: ComposerToolbarProps): React.ReactElement {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-[4px] px-[8px] pb-[8px] pt-[6px]">
      <Button variant="ghost" size="sm" title={t("composer.attach_title")} onClick={props.onAttachClick} aria-label={t("composer.attach_title")}>
        <Icon name="attach" />
      </Button>
      <Button variant="ghost" size="sm" title={t("composer.slash_insert_title")} onClick={props.onSlashClick} aria-label={t("composer.slash_insert_aria")}>
        <Icon name="slash" />
      </Button>
      <Button variant="ghost" size="sm" title={`${t("prompts.open_picker")} (Ctrl+P)`} aria-label={t("prompts.open_picker")} onClick={props.onPromptPickerOpen}>
        <Icon name="sparkle" />
      </Button>
      {props.cwdChip ? <ToolbarChip title="working directory" text={props.cwdChip} /> : null}
      {props.modelChip ? <ToolbarChip title="active model" text={props.modelChip} /> : null}
      {props.onProfileChange ? <ProfileToggle current={props.contextProfile} onChange={props.onProfileChange} /> : null}
      <div className="ml-auto flex items-center gap-[6px]">
        {props.abortable ? (
          <Button size="sm" onClick={props.onAbort}>
            <Icon name="stop" /> {t("common.abort")}
          </Button>
        ) : (
          <SendShortcutHint t={t} />
        )}
        <SendButton disabled={props.sendDisabled} onSend={props.onSend} label={t("composer.send_label")} />
      </div>
    </div>
  );
}

function ToolbarChip({ title, text }: { title: string; text: string }): React.ReactElement {
  return (
    <span
      className="inline-flex items-center gap-[5px] bg-bg-2 border border-line text-txt-2 rounded-full cursor-pointer px-[8px] py-[3px] text-[11.5px] font-[var(--font-mono)] hover:bg-bg-3"
      title={title}
    >
      {text}
    </span>
  );
}

function ProfileToggle({ current, onChange }: { current: ContextProfile; onChange: (p: ContextProfile) => void }): React.ReactElement {
  const cycle = () => {
    const next = PROFILE_CYCLE[(PROFILE_CYCLE.indexOf(current) + 1) % PROFILE_CYCLE.length] ?? "balanced";
    onChange(next);
  };
  return (
    <button
      type="button"
      title="Context profile — click to cycle"
      onClick={cycle}
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full cursor-pointer px-[8px] py-[3px] text-[11.5px] font-[var(--font-mono)] transition-colors",
        current === "balanced"
          ? "bg-bg-2 border border-line text-txt-2 hover:bg-bg-3"
          : "bg-acc-faint border border-acc-tint text-acc hover:bg-acc-softer",
      )}
    >
      ctx:{current} <span className="text-txt-4">{PROFILE_TOK[current]}</span>
    </button>
  );
}

function SendShortcutHint({ t }: { t: ReturnType<typeof useTranslations> }): React.ReactElement {
  const kbd = (label: string) => (
    <span className="inline-block bg-bg-1 text-txt-2 px-[5px] py-[1px] border border-b-2 border-line-2 rounded font-mono text-[10.5px]">
      {label}
    </span>
  );
  return (
    <span className="text-[11px] text-[var(--txt-4)] font-mono">
      {kbd("⏎")} {t("composer.shortcut_send")} · {kbd("⇧⏎")} {t("composer.shortcut_newline")}
    </span>
  );
}

function SendButton({ disabled, onSend, label }: { disabled: boolean; onSend: () => void; label: string }): React.ReactElement {
  return (
    <button
      type="button"
      className="send-btn bg-acc text-white border-none inline-flex items-center justify-center cursor-pointer w-[32px] h-[32px] rounded-[10px] [box-shadow:0_1px_0_rgba(0,0,0,0.08),0_2px_6px_rgba(233,84,32,0.30)] hover:bg-[var(--acc-hover)] disabled:bg-bg-3 disabled:text-txt-3 disabled:cursor-not-allowed disabled:[box-shadow:none]"
      onClick={onSend}
      disabled={disabled}
      aria-label={label}
    >
      <Icon name="send" />
    </button>
  );
}
