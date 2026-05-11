"use client";

import { PixelSprite } from "@/components/ui/pixel-sprite";
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
  const pill = phase === "streaming" || phase === "starting" ? "working" : null;
  return (
    <div className="chat-head">
      <div className="av">
        <PixelSprite
          agent={agent}
          size={40}
          action={pill === "working" ? "typing" : "idle"}
          animate={false}
        />
      </div>
      <div>
        <h2>{agent.name}</h2>
        <div className="sub">
          {agent.id} · {agent.defaultModel ?? "default"} · effort {agent.defaultEffort ?? "default"}
        </div>
      </div>
      <span className={"pill" + (pill ? ` ${pill}` : "")}>{phase === "idle" ? agent.status : phase}</span>
      <div className="right">
        <span
          className="pill"
          title="tokens in / out · cost"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          {usage.tokensIn.toLocaleString()}↓ {usage.tokensOut.toLocaleString()}↑ · $
          {usage.cost.toFixed(4)}
        </span>
        <button
          type="button"
          className="btn sm ghost"
          title="Branch conversation"
          onClick={onBranch}
          disabled={!onBranch}
        >
          <Icon name="branch" /> Branch
        </button>
        <button
          type="button"
          className="btn sm ghost"
          title="New thread"
          onClick={onNew}
          disabled={!onNew}
        >
          <Icon name="plus" /> New
        </button>
        <button
          type="button"
          className="btn sm ghost"
          title="Edit agent"
          onClick={onEdit}
          disabled={!onEdit}
          aria-label="Edit agent"
        >
          <Icon name="edit" />
        </button>
      </div>
    </div>
  );
}
