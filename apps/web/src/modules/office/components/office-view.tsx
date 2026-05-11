"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { match } from "ts-pattern";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { OfficeToolbar } from "./office-toolbar";
import { OfficeHud } from "./office-hud";
import { OfficeScene } from "./office-scene";
import { CardsOffice } from "./cards-office";
import { useOfficeStore } from "../hooks/use-office-store";
import { useOfficeAgents } from "../hooks/use-office-agents";
import { ChatPanel } from "@/modules/summon/components/chat-panel";
import { useSummonStore } from "@/modules/summon/hooks/use-summon-store";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject } from "@/modules/projects/hooks/use-projects";

export function OfficeView() {
  const t = useTranslations();
  const view = useOfficeStore((s) => s.view);
  const setView = useOfficeStore((s) => s.setView);
  const selectedId = useOfficeStore((s) => s.selectedId);
  const select = useOfficeStore((s) => s.select);

  const chatOpen = useSummonStore((s) => s.open);
  const chatAgentId = useSummonStore((s) => s.agentId);
  const projectId = useSummonStore((s) => s.projectId);
  const instanceId = useSummonStore((s) => s.instanceId);
  const closeChat = useSummonStore((s) => s.closeChat);

  const { agents, workingCount, idleCount, errorCount, spendToday, isLoading } = useOfficeAgents();
  const activeProjectId = useActiveProjectStore((s) => s.id);
  const projectQ = useProject(activeProjectId);
  const project = projectQ.data;

  const scopedAgents = useMemo(() => {
    if (!activeProjectId) return agents;
    if (!project) return [];
    const rosterIds = new Set(project.meta.roster.map((i) => i.agentId));
    return agents.filter((a) => rosterIds.has(a.id));
  }, [agents, activeProjectId, project]);

  const floorLoading = isLoading || (!!activeProjectId && projectQ.isLoading);

  const chatAgent = agents.find((a) => a.id === chatAgentId) ?? null;

  // Office floor click → resolve to the first instance of this agent in the
  // active project's roster so the chat opens against the same instanceId
  // the sidebar uses. Without this, clicking the floor produces a different
  // tKey than clicking the sidebar row, and transcripts split between them.
  // Limitation: agents with multiple instances are only reachable here as
  // their first instance; secondary ones still need the sidebar.
  const selectFromFloor = useCallback(
    (id: string) => {
      const instance = project?.meta.roster.find((i) => i.agentId === id);
      select(id, { instanceId: instance?.instanceId ?? null });
    },
    [project, select],
  );

  if (chatOpen && chatAgent) {
    return <ChatPanel agent={chatAgent} projectId={projectId} instanceId={instanceId} onClose={closeChat} />;
  }

  return (
    <>
      <OfficeToolbar
        view={view}
        setView={setView}
        agentCount={agents.length}
        workingCount={workingCount}
      />
      <div className="office">
        <OfficeHud
          workingCount={workingCount}
          idleCount={idleCount}
          errorCount={errorCount}
          spendToday={spendToday}
        />

        {/* Iso view: new game-asset-based scene. Always renders, even with
            zero agents — the scene itself is the view; agents are placed on
            top in later iterations. Cards view keeps its existing
            loading/empty-state branches since it's a list, not a canvas. */}
        {view === "iso" ? (
          <OfficeScene />
        ) : (
          match({ isLoading: floorLoading, hasProject: !!project, count: scopedAgents.length })
            .with({ isLoading: true }, () => (
              <div style={{ padding: 24 }}>
                <Skeleton width={200} height={20} />
                <div style={{ height: 12 }} />
                <Skeleton width="100%" height={400} />
              </div>
            ))
            .with({ hasProject: true, count: 0 }, () => (
              <EmptyState
                icon="users"
                title={t("office.empty_roster_title")}
                description={t("office.empty_roster_hint")}
              />
            ))
            .with({ hasProject: false, count: 0 }, () => (
              <EmptyState
                icon="users"
                title={t("office.no_project_selected")}
                description={t("office.no_project_hint")}
              />
            ))
            .otherwise(() => (
              <CardsOffice agents={scopedAgents} selectedId={selectedId} onSelect={selectFromFloor} />
            ))
        )}
      </div>
    </>
  );
}
