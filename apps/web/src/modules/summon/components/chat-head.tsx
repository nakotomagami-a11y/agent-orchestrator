"use client";

import { useTranslations } from "next-intl";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { Icon } from "@/components/ui/icon";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { RunPhase, UsageMeter } from "../utils/thread-types";

export type ChatHeadProps = {
  agent: OfficeAgent;
  phase: RunPhase;
  usage: UsageMeter;
  onClose: () => void;
};

export function ChatHead({ agent, phase, usage, onClose }: ChatHeadProps) {
  const t = useTranslations();
  return (
    <div className="chat-head">
      <div className="av">
        <PixelSprite agent={agent} size={40} action={phase === "streaming" ? "typing" : "idle"} animate={false} />
      </div>
      <div>
        <h2>{agent.name}</h2>
        <div className="sub">{agent.id}</div>
      </div>
      <span className={"pill" + (phase === "streaming" ? " working" : "")}>
        {phase === "streaming" ? "streaming" : phase}
      </span>
      <div className="right">
        <span className="pill" title="tokens in / out · cost">
          {usage.tokensIn}↓ {usage.tokensOut}↑ · ${usage.cost.toFixed(4)}
        </span>
        <button type="button" className="btn ghost" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="x" />
        </button>
      </div>
    </div>
  );
}
