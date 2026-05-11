"use client";

import { useTranslations } from "next-intl";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { Icon } from "@/components/ui/icon";
import type { OfficeAgent } from "../hooks/use-office-agents";

export type InspectorProps = {
  agent: OfficeAgent;
  onClose: () => void;
  onOpenChat?: () => void;
};

export function Inspector({ agent, onClose, onOpenChat }: InspectorProps) {
  const t = useTranslations();
  return (
    <aside className="inspector" aria-label={`${agent.name} details`}>
      <div className="ihead">
        <div style={{ width: 36, height: 36 }}>
          <PixelSprite
            agent={agent}
            size={36}
            animate={false}
            action={agent.status === "working" ? "typing" : "idle"}
          />
        </div>
        <div>
          <h3>{agent.name}</h3>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>{agent.id}</div>
        </div>
        <button type="button" className="iclose" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="x" />
        </button>
      </div>
      <div className="desc">{agent.description || "No description set."}</div>
      <div className="kv">
        <span className="k">model</span>
        <span className="v">
          {agent.defaultModel ?? "default"} · {agent.defaultEffort ?? "default"}
        </span>
        <span className="k">skills</span>
        <span className="v">{agent.skills.length > 0 ? agent.skills.map((s) => `#${s}`).join(" ") : "—"}</span>
        <span className="k">tools</span>
        <span className="v">{agent.tools.length} allowed</span>
        <span className="k">status</span>
        <span
          className="v"
          style={{
            color:
              agent.status === "error"
                ? "var(--error)"
                : agent.status === "working"
                  ? "var(--acc)"
                  : "var(--txt)",
          }}
        >
          {agent.status}
          {agent.task ? ` — ${agent.task}` : ""}
        </span>
      </div>
      <div className="iactivity" />
      <div className="ibtns">
        <button type="button" className="btn primary" style={{ flex: 1 }} onClick={onOpenChat} disabled={!onOpenChat}>
          <Icon name="send" /> {t("summon.open_chat")}
        </button>
        <button type="button" className="btn" aria-label={t("common.edit")}>
          <Icon name="edit" />
        </button>
      </div>
    </aside>
  );
}
