"use client";

import { useTranslations } from "next-intl";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { Icon } from "@/components/ui/icon";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { RunPhase, UsageMeter } from "../utils/thread-types";

export type ChatHeadProps = {
  agent: OfficeAgent;
  phase: RunPhase;
  usage: UsageMeter;
  onBranch?: () => void;
  onNew?: () => void;
  onEdit?: () => void;
};

export function ChatHead({ agent, phase, usage, onBranch, onNew, onEdit }: ChatHeadProps) {
  const t = useTranslations();
  const pill = phase === "streaming" || phase === "starting" ? "working" : null;
  return (
    <div className="chat-head">
      <div className="av">
        <UnitSprite
          unit={agent.unitChoice}
          size={40}
          action={pill === "working" ? "working" : "idle"}
          animate
        />
      </div>
      <div>
        <h2>{agent.name}</h2>
        <div className="sub">
          {t("chat_head.sub", {
            id: agent.id,
            model: agent.defaultModel ?? t("chat_head.model_default"),
            effort: agent.defaultEffort ?? t("chat_head.effort_default"),
          })}
        </div>
      </div>
      <span className={"pill" + (pill ? ` ${pill}` : "")}>{phase === "idle" ? agent.status : phase}</span>
      <div className="right">
        <span
          className="pill"
          title={t("chat_head.usage_title")}
          style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          {usage.tokensIn.toLocaleString()}↓ {usage.tokensOut.toLocaleString()}↑ · $
          {usage.cost.toFixed(4)}
        </span>
        <button
          type="button"
          className="btn sm ghost"
          title={t("chat_head.branch_title")}
          onClick={onBranch}
          disabled={!onBranch}
        >
          <Icon name="branch" /> {t("chat_head.branch_button")}
        </button>
        <button
          type="button"
          className="btn sm ghost"
          title={t("chat_head.new_title")}
          onClick={onNew}
          disabled={!onNew}
        >
          <Icon name="plus" /> {t("chat_head.new_button")}
        </button>
        <button
          type="button"
          className="btn sm ghost"
          title={t("chat_head.edit_title")}
          onClick={onEdit}
          disabled={!onEdit}
          aria-label={t("chat_head.edit_aria")}
        >
          <Icon name="edit" />
        </button>
      </div>
    </div>
  );
}
