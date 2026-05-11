"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/ui/tag";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { useProject, useRemoveInstance, useUpdateProject } from "../hooks/use-projects";
import { useSummonStore } from "@/modules/summon/hooks/use-summon-store";

export type ProjectDetailProps = { id: string };

export function ProjectDetail({ id }: ProjectDetailProps) {
  const t = useTranslations();
  const projectQ = useProject(id);
  const updateMut = useUpdateProject();
  const removeMut = useRemoveInstance();
  const openChat = useSummonStore((s) => s.openChat);
  const [memoryDraft, setMemoryDraft] = useState<string | null>(null);

  if (projectQ.isLoading) {
    return (
      <div className="tab-pane">
        <Skeleton width="100%" height={200} />
      </div>
    );
  }
  if (!projectQ.data) {
    return <div className="tab-pane">{t("errors.not_found")}</div>;
  }

  const project = projectQ.data;
  const memoryValue = memoryDraft ?? project.memory;
  const memoryDirty = memoryDraft !== null && memoryDraft !== project.memory;

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <CardHeader title={project.meta.name} sub={project.meta.cwd} />
        <div style={{ padding: 16, fontSize: 13, color: "var(--txt-2)" }}>
          {project.meta.description || "(no description)"}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Roster"
          sub={`${project.meta.roster.length} agent${project.meta.roster.length === 1 ? "" : "s"}`}
        />
        <div>
          {project.meta.roster.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--txt-3)" }}>
              No agents added yet. Use the office page to summon and assign.
            </div>
          ) : (
            project.meta.roster.map((inst) => (
              <div
                key={inst.instanceId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <Icon name="users" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inst.label ?? inst.agentId}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--txt-3)" }}>
                    {inst.instanceId} · {inst.agentId}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {inst.model ? <Tag>model: {inst.model}</Tag> : null}
                  {inst.effort ? <Tag>effort: {inst.effort}</Tag> : null}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() => openChat(inst.agentId, { projectId: id, instanceId: inst.instanceId })}
                  >
                    <Icon name="send" /> Chat
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => removeMut.mutate({ projectId: id, instanceId: inst.instanceId })}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Memory"
          sub={`composes into every roster summon for ${project.meta.name}`}
          right={
            <button
              type="button"
              className="btn primary"
              disabled={!memoryDirty || updateMut.isPending}
              onClick={() =>
                updateMut.mutate(
                  { id, patch: { memory: memoryDraft ?? "" } },
                  { onSuccess: () => setMemoryDraft(null) },
                )
              }
            >
              {updateMut.isPending ? "Saving…" : t("common.save")}
            </button>
          }
        />
        <div style={{ padding: 16 }}>
          <Textarea
            value={memoryValue}
            onChange={(e) => setMemoryDraft(e.target.value)}
            rows={12}
            placeholder="Project-wide context that prepends to every agent prompt."
          />
        </div>
      </Card>
    </div>
  );
}
