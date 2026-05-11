"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";

export type ComposerProps = {
  disabled?: boolean;
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  abortable?: boolean;
};

export function Composer({ disabled, onSubmit, onAbort, abortable }: ComposerProps) {
  const t = useTranslations();
  const [value, setValue] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setValue("");
    textRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="composer">
      <div className="composer-inner">
        <div className="composer-box">
          <textarea
            ref={textRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything…"
            aria-label="Message"
            rows={2}
          />
          <div className="composer-bar">
            <span className="chip" aria-hidden>
              <Icon name="slash" /> command
            </span>
            <div className="right">
              {abortable ? (
                <button type="button" className="btn sm" onClick={onAbort}>
                  <Icon name="stop" /> {t("common.abort")}
                </button>
              ) : null}
              <button
                type="button"
                className="send-btn"
                onClick={send}
                disabled={disabled || !value.trim()}
                aria-label={t("summon.send")}
              >
                <Icon name="send" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
