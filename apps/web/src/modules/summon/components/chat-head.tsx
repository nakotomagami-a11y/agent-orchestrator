"use client";

import { useTranslations } from "next-intl";
import { UnitSprite } from "@/components/ui/unit-sprite";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
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
    <div className="flex items-center gap-3 px-[18px] py-3 border-b border-[var(--line)]">
      <div className="w-[40px] h-[40px]">
        <UnitSprite
          unit={agent.unitChoice}
          size={40}
          action={pill === "working" ? "working" : "idle"}
          animate
        />
      </div>
      <div>
        <h2 className="m-0 text-[15px] font-bold tracking-[-0.01em]">{agent.name}</h2>
        <div className="text-[11.5px] text-[var(--txt-3)] font-[var(--font-mono)]">
          {t("chat_head.sub", {
            id: agent.id,
            model: agent.defaultModel ?? t("chat_head.model_default"),
            effort: agent.defaultEffort ?? t("chat_head.effort_default"),
          })}
        </div>
      </div>
      <span className={pill === "working"
        ? "font-[var(--font-mono)] text-[10.5px] inline-flex items-center h-[26px] px-[9px] rounded-[8px] bg-[var(--acc-faint)] text-[var(--acc)] border border-[rgba(233,84,32,0.2)]"
        : "font-[var(--font-mono)] text-[10.5px] inline-flex items-center h-[26px] px-[9px] rounded-[8px] bg-[var(--bg-2)] text-[var(--txt-2)] border border-[var(--line)]"
      }>{phase === "idle" ? agent.status : phase}</span>
      <div className="ml-auto flex gap-[6px]">
        <span
          className="font-[var(--font-mono)] text-[10.5px] inline-flex items-center h-[26px] px-[9px] rounded-[8px] bg-[var(--bg-2)] text-[var(--txt-2)] border border-[var(--line)] font-mono text-[11px]"
          title={t("chat_head.usage_title")}
        >
          {usage.tokensIn.toLocaleString()}↓ {usage.tokensOut.toLocaleString()}↑ · $
          {usage.cost.toFixed(4)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          title={t("chat_head.branch_title")}
          onClick={onBranch}
          disabled={!onBranch}
        >
          <Icon name="branch" /> {t("chat_head.branch_button")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title={t("chat_head.new_title")}
          onClick={onNew}
          disabled={!onNew}
        >
          <Icon name="plus" /> {t("chat_head.new_button")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title={t("chat_head.edit_title")}
          onClick={onEdit}
          disabled={!onEdit}
          aria-label={t("chat_head.edit_aria")}
        >
          <Icon name="edit" />
        </Button>
      </div>
    </div>
  );
}
