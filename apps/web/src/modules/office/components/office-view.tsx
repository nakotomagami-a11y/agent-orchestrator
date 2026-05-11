"use client";

import { useMemo } from "react";
import { match } from "ts-pattern";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { OfficeToolbar } from "./office-toolbar";
import { OfficeHud } from "./office-hud";
import { OfficeZoom } from "./office-zoom";
import { IsoOffice } from "./iso-office";
import { CardsOffice } from "./cards-office";
import { useOfficeStore } from "../hooks/use-office-store";
import { useOfficeAgents } from "../hooks/use-office-agents";
import { ChatPanel } from "@/modules/summon/components/chat-panel";
import { useSummonStore } from "@/modules/summon/hooks/use-summon-store";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { useProject } from "@/modules/projects/hooks/use-projects";

export function OfficeView() {
  const view = useOfficeStore((s) => s.view);
  const setView = useOfficeStore((s) => s.setView);
  const zoom = useOfficeStore((s) => s.zoom);
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

        {match({ isLoading: floorLoading, hasProject: !!project, count: scopedAgents.length })
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
              title={`No agents in ${project?.meta.name}`}
              description="Use the 'Add agent' button to bring an agent into this project's roster."
            />
          ))
          .with({ hasProject: false, count: 0 }, () => (
            <EmptyState
              icon="users"
              title="No agents yet"
              description="Drop a markdown file in ~/.claude/agents/ or pick a project from the top-left switcher."
            />
          ))
          .otherwise(() =>
            view === "iso" ? (
              <IsoOffice agents={scopedAgents} selectedId={selectedId} onSelect={select} zoom={zoom} />
            ) : (
              <CardsOffice agents={scopedAgents} selectedId={selectedId} onSelect={select} />
            ),
          )}

        {view === "iso" && scopedAgents.length > 0 ? <OfficeZoom /> : null}
      </div>
    </>
  );
}
