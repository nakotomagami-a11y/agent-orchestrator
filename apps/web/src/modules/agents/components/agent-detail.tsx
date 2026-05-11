"use client";

import { useState } from "react";
import Link from "next/link";
import { match } from "ts-pattern";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { Tag } from "@/components/ui/tag";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeBlock } from "@/components/ui/code-block";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { paletteForAgent } from "@/modules/office/utils/sprite-palette";
import { useAgent, useAgentBody, useAgentMemory, useWriteAgentMemory } from "../hooks/use-agents";
import { ActivityFeed } from "@/modules/runs/components/activity-feed";
import { useSummonStore } from "@/modules/summon/hooks/use-summon-store";
import { MemoryEditor } from "@/modules/memory/components/memory-editor";

export type AgentDetailProps = { id: string };

type TabValue = "prompt" | "memory" | "runs";

export function AgentDetail({ id }: AgentDetailProps) {
  const t = useTranslations();
  const [tab, setTab] = useState<TabValue>("prompt");
  const agentQ = useAgent(id);
  const bodyQ = useAgentBody(id);

  const sprite = paletteForAgent(id);
  const openChat = useSummonStore((s) => s.openChat);

  if (agentQ.isLoading) {
    return (
      <div className="tab-pane">
        <Skeleton width={240} height={28} />
        <div style={{ height: 12 }} />
        <Skeleton width="100%" height={200} />
      </div>
    );
  }
  if (!agentQ.data) {
    return <div className="tab-pane">{t("errors.not_found")}</div>;
  }
  const agent = agentQ.data;

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
          <div style={{ width: 56, height: 56, flex: "none" }}>
            <PixelSprite agent={sprite} size={56} animate={false} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{agent.name}</h2>
            <div style={{ fontSize: 12, color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>{id}</div>
            <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 4 }}>{agent.description || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn primary" onClick={() => openChat(id)}>
              <Icon name="send" /> {t("summon.open_chat")}
            </button>
            <Link href={PAGE_ROUTES.agentEdit(id)} className="btn">
              <Icon name="edit" /> {t("common.edit")}
            </Link>
          </div>
        </div>
        <div style={{ padding: "0 16px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {agent.skills.map((s) => (
            <Tag key={s} variant="skill">#{s}</Tag>
          ))}
          {agent.skills.length === 0 ? <span style={{ fontSize: 12, color: "var(--txt-3)" }}>no skills</span> : null}
          <span style={{ flex: 1 }} />
          <Tag>model: {agent.defaultModel ?? "default"}</Tag>
          <Tag>effort: {agent.defaultEffort ?? "default"}</Tag>
          <Tag>{agent.tools.length} tools</Tag>
        </div>
      </Card>

      <Tabs<TabValue>
        items={[
          { value: "prompt", label: "System prompt" },
          { value: "memory", label: "Memory" },
          { value: "runs", label: "Recent runs" },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Agent detail sections"
      />

      {match(tab)
        .with("prompt", () => (
          <Card>
            <CardHeader title="System prompt" sub={`~/.claude/agents/${id}.md`} />
            <div style={{ padding: 16 }}>
              {bodyQ.isLoading ? (
                <Skeleton width="100%" height={200} />
              ) : (
                <CodeBlock body={bodyQ.data ?? ""} lang="markdown" />
              )}
            </div>
          </Card>
        ))
        .with("memory", () => <AgentMemoryCard id={id} />)
        .with("runs", () => <ActivityFeed agentId={id} />)
        .exhaustive()}
    </div>
  );
}

function AgentMemoryCard({ id }: { id: string }) {
  const t = useTranslations();
  const memoryQ = useAgentMemory(id);
  const writeMut = useWriteAgentMemory();

  if (memoryQ.isLoading) return <Skeleton width="100%" height={200} />;

  return (
    <Card>
      <CardHeader
        title="Memory"
        sub={`~/.claude/agents/${id}.memory.md`}
      />
      <div style={{ padding: 16 }}>
        <MemoryEditor
          value={memoryQ.data ?? ""}
          onSave={(content) => writeMut.mutateAsync({ id, content })}
          rows={14}
          placeholder="# Notes for this agent that compose into its system prompt at summon time."
          saveLabel={t("common.save")}
        />
      </div>
    </Card>
  );
}
