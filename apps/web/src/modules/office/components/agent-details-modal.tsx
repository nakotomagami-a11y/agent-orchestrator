"use client";

import { useTranslations } from "next-intl";
import { ModalShell } from "@/components/ui/modal-shell";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { Icon } from "@/components/ui/icon";
import { useOfficeAgents } from "../hooks/use-office-agents";
import { useOfficeStore } from "../hooks/use-office-store";
import { useSummonStore } from "@/modules/summon/hooks/use-summon-store";

/**
 * Global agent-details modal. Mounted once at the app shell so the same
 * selection state opens an overlay regardless of which route the user is on
 * (sidebar agent click, desk click in the iso office, etc.).
 */
export function AgentDetailsModal() {
  const t = useTranslations();
  const selectedId = useOfficeStore((s) => s.selectedId);
  const inspectorOpen = useOfficeStore((s) => s.inspectorOpen);
  const closeInspector = useOfficeStore((s) => s.closeInspector);
  const openChat = useSummonStore((s) => s.openChat);
  const { agents } = useOfficeAgents();
  const agent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  return (
    <ModalShell
      open={inspectorOpen && !!agent}
      onClose={closeInspector}
      size="md"
      title={agent?.name}
      footer={
        agent ? (
          <>
            <button type="button" className="btn" onClick={closeInspector}>
              {t("common.close")}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                openChat(agent.id);
                closeInspector();
              }}
            >
              <Icon name="send" /> {t("summon.open_chat")}
            </button>
          </>
        ) : null
      }
    >
      {agent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48 }}>
              <PixelSprite
                agent={agent}
                size={48}
                animate={false}
                action={agent.status === "working" ? "typing" : "idle"}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--txt-3)",
                }}
              >
                {agent.id}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color:
                    agent.status === "error"
                      ? "var(--error)"
                      : agent.status === "working"
                        ? "var(--acc)"
                        : "var(--txt-2)",
                }}
              >
                {agent.status}
                {agent.task ? ` — ${agent.task}` : ""}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "var(--txt-2)", lineHeight: 1.5 }}>
            {agent.description || "No description set."}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              gap: "6px 10px",
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              model
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              {agent.defaultModel ?? "default"} · {agent.defaultEffort ?? "default"}
            </span>
            <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              skills
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              {agent.skills.length > 0 ? agent.skills.map((s) => `#${s}`).join(" ") : "—"}
            </span>
            <span style={{ color: "var(--txt-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              tools
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              {agent.tools.length} allowed
            </span>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}
