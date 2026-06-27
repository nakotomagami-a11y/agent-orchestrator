"use client";

import { useTranslations } from "next-intl";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { RosterInstanceRow } from "./roster-instance-row";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { AgentInstance } from "@agent-office/shared/types";
import type { AgentStatusInfo } from "@/modules/office/utils/derive-status";
import {
  AGENT_DRAG_MIME,
  useOfficeDragStore,
  type DragRef,
} from "@/modules/office/hooks/use-office-drag";

const LIVE: AgentStatusInfo["status"][] = ["working", "thinking"];

function agentLedClass(status: AgentStatusInfo["status"]) {
  return cn(
    "absolute -bottom-[2px] -right-[2px] w-[8px] h-[8px] rounded-full border-[2px] border-bg-2",
    LIVE.includes(status) && "bg-[var(--working)] shadow-[0_0_5px_var(--working)]",
    (status === "queued" || status === "done") && "bg-[#e6b35a]",
    status === "error" && "bg-[var(--error)]",
    !LIVE.includes(status) && status !== "queued" && status !== "done" && status !== "error" && "bg-txt-4",
  );
}

const STATUS_PRIORITY: AgentStatusInfo["status"][] = [
  "idle", "done", "queued", "thinking", "working", "error",
];

function aggregateStatus(statuses: AgentStatusInfo["status"][]): AgentStatusInfo["status"] {
  let best: AgentStatusInfo["status"] = "idle";
  for (const s of statuses) {
    if (STATUS_PRIORITY.indexOf(s) > STATUS_PRIORITY.indexOf(best)) best = s;
  }
  return best;
}

export interface RosterGroupData {
  agentId: string;
  agent: OfficeAgent;
  instances: AgentInstance[];
  instanceStatuses: AgentStatusInfo["status"][];
  expanded: boolean;
}

export interface RosterGroupProps {
  group: RosterGroupData;
  projectId: string;
  selectedInstanceId: string | null;
  renamingInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onSpawn: (agentId: string) => void;
  onRemove: (instanceId: string) => void;
  onToggle: () => void;
  onRenameStart: (instanceId: string) => void;
  onRenameCommit: (instanceId: string, label: string) => void;
  onRenameCancel: () => void;
  spendByInstance?: Record<string, number>;
}

export function RosterGroup({
  group,
  projectId: _projectId,
  selectedInstanceId,
  renamingInstanceId,
  onSelect,
  onSpawn,
  onRemove,
  onToggle,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  spendByInstance = {},
}: RosterGroupProps) {
  const t = useTranslations();
  const { agent, instances, instanceStatuses, expanded } = group;
  const isMulti = instances.length > 1;
  const setDragging = useOfficeDragStore((s) => s.setDragging);

  const inst = instances[0];
  const singleStatus = instanceStatuses[0] ?? "idle";
  const aggregated = isMulti ? aggregateStatus(instanceStatuses) : singleStatus;
  const hasLive = instanceStatuses.some((s) => LIVE.includes(s));

  const dragRef: DragRef = isMulti || !inst
    ? { agentId: agent.id }
    : { agentId: agent.id, instanceId: inst.instanceId };

  const isSelected = !isMulti && inst ? selectedInstanceId === inst.instanceId : false;

  return (
    <div>
      {/* Agent row */}
      <div
        className={cn("ag-row group", isSelected && "bg-acc-faint")}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(AGENT_DRAG_MIME, JSON.stringify(dragRef));
          e.dataTransfer.setData("text/plain", agent.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(dragRef);
        }}
        onDragEnd={() => setDragging(null)}
        onClick={() => isMulti ? onToggle() : (inst && onSelect(inst.instanceId))}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ")
            isMulti ? onToggle() : (inst && onSelect(inst.instanceId));
        }}
        aria-expanded={isMulti ? expanded : undefined}
      >
        {/* Avatar + LED */}
        <div className="relative w-8 h-8">
          <AgentAvatar unit={agent.unitChoice} size={40} />
          <span className={agentLedClass(aggregated)} />
        </div>

        {/* Name */}
        <span className="text-[14px] font-semibold text-txt overflow-hidden text-ellipsis whitespace-nowrap">
          {agent.name}
        </span>

        {/* Right section */}
        <div className="flex items-center gap-[6px] text-txt-4">
          {isMulti ? (
            <>
              <span className={cn(
                "px-[7px] py-[1px] rounded-full font-[var(--font-mono)] text-[10.5px] font-bold tracking-[0.02em]",
                hasLive
                  ? "bg-acc-faint border border-acc-tint text-acc"
                  : "bg-bg-3 border border-line text-txt-3",
              )}>
                {instances.length}
              </span>
              <span className={cn(
                "w-[18px] h-[18px] grid place-items-center transition-transform duration-[160ms]",
                expanded ? "rotate-90 text-acc" : "text-txt-4",
              )}>
                <Icon name="chevron" size={11} />
              </span>
            </>
          ) : (
            <span className="flex gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]">
              <Tooltip content={t("sidebar.spawn_instance_title")} side="top">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSpawn(agent.id); }}
                  aria-label={t("sidebar.spawn_instance_aria", { name: agent.name })}
                  className="w-[20px] h-[20px] bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 hover:text-acc hover:border-acc transition-colors cursor-pointer"
                >
                  <Icon name="plus" size={10} />
                </button>
              </Tooltip>
              {inst && (
                <Tooltip content={t("sidebar.remove_from_project_title")} side="top">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(inst.instanceId); }}
                    aria-label={t("sidebar.remove_from_project_aria", { name: agent.name })}
                    className="w-[20px] h-[20px] bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 hover:text-[var(--error)] hover:border-[var(--error)] transition-colors cursor-pointer"
                  >
                    <Icon name="x" size={10} />
                  </button>
                </Tooltip>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Expanded sessions tree */}
      {isMulti && expanded && (
        <div className="ag-sessions">
          {instances.map((inst, idx) => {
            const spendKey = `${inst.agentId}|${inst.instanceId}`;
            const instSpend = spendByInstance[spendKey] ?? 0;
            return (
              <RosterInstanceRow
                key={inst.instanceId}
                instanceId={inst.instanceId}
                instanceNumber={idx + 1}
                label={inst.label}
                status={instanceStatuses[idx] ?? "idle"}
                isSelected={selectedInstanceId === inst.instanceId}
                onSelect={() => onSelect(inst.instanceId)}
                onRemove={() => onRemove(inst.instanceId)}
                onRename={() => onRenameStart(inst.instanceId)}
                isRenaming={renamingInstanceId === inst.instanceId}
                onRenameCommit={(label) => onRenameCommit(inst.instanceId, label)}
                onRenameCancel={onRenameCancel}
                spend={instSpend > 0 ? instSpend : undefined}
              />
            );
          })}
          <button
            type="button"
            className="ses-new"
            onClick={(e) => { e.stopPropagation(); onSpawn(agent.id); }}
            aria-label={t("sidebar.spawn_instance_aria", { name: agent.name })}
          >
            <Icon name="plus" size={11} />
            New session
          </button>
        </div>
      )}
    </div>
  );
}
