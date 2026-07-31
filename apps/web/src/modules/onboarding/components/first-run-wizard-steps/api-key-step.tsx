"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TextInput } from "@/components/ui/text-input";

export type ApiKeyStepProps = {
  apiKey: string;
  onApiKeyChange: (v: string) => void;
};

/**
 * Wizard step 2: optional Anthropic API key entry.
 *
 * Users who authenticate via `claude auth login` (subscription plan) can skip
 * this — the CLI already has credentials. Users calling the API directly need
 * to provide their key here so Agent Office can inject it when spawning
 * `claude` subprocesses.
 */
export function ApiKeyStep({ apiKey, onApiKeyChange }: ApiKeyStepProps) {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);

  return (
    <section>
      <h3 className="font-semibold m-0 mb-[6px] text-[15px]">{t("first_run.api_key_title")}</h3>
      <p className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]">{t("first_run.api_key_hint")}</p>

      <div className="relative">
        <TextInput
          type={visible ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="sk-ant-…"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[11px] text-txt-3 hover:text-txt-1 transition-colors select-none"
          aria-label={visible ? t("first_run.api_key_hide") : t("first_run.api_key_show")}
        >
          {visible ? t("first_run.api_key_hide") : t("first_run.api_key_show")}
        </button>
      </div>

      <p className="text-txt-3 m-0 text-[11.5px] leading-[1.5] mt-[8px]">
        {t("first_run.api_key_skip_hint")}
      </p>

      <div className="mt-[16px] p-[12px] rounded-[6px] bg-[var(--bg-2)] border border-line text-[11.5px] text-txt-3 leading-[1.6]">
        <strong className="text-txt-2">{t("first_run.api_key_alt_title")}</strong>
        <br />
        {t("first_run.api_key_alt_hint")}
      </div>
    </section>
  );
}
