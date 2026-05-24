"use client";

import { useTranslations } from "next-intl";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Icon } from "@/components/ui/icon";
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

function StatusDot({
  status,
  size = 8,
  className,
}: {
  status: AgentStatusInfo["status"];
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0",
        status === "working" && "bg-[var(--working)] shadow-[0_0_0_3px_rgba(34,197,94,0.25)] animate-[pulseDot_1.8s_infinite_ease-in-out]",
        status === "done" && "bg-[var(--done)]",
        status === "queued" && "bg-[var(--queued)]",
        status === "error" && "bg-[var(--error)]",
        status === "thinking" && "bg-[var(--thinking)] animate-[pulseDot_1.8s_infinite_ease-in-out]",
        !["working", "done", "queued", "error", "thinking"].includes(status) && "bg-[var(--txt-4)]",
        className,
      )}
      style={{ width: size, height: size }}
      title={status}
      aria-label={status}
    />
  );
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

  // ─── Single-instance row ──────────────────────────────────────────────────
  if (!isMulti) {
    const inst = instances[0];
    const instStatus = instanceStatuses[0] ?? "idle";
    const isSelected = inst ? selectedInstanceId === inst.instanceId : false;
    const displayName = inst?.label ?? agent.name;

    const dragRef: DragRef = inst
      ? { agentId: agent.id, instanceId: inst.instanceId }
      : { agentId: agent.id };

    return (
      <div
        className={cn(
          "group relative flex items-center gap-[8px] rounded-[var(--r-sm)] hover:bg-bg-3 cursor-grab px-[8px] py-[6px]",
          isSelected ? "bg-acc-faint" : "",
        )}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(AGENT_DRAG_MIME, JSON.stringify(dragRef));
          e.dataTransfer.setData("text/plain", agent.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(dragRef);
        }}
        onDragEnd={() => setDragging(null)}
      >
        {/* Avatar — also acts as a click target for select */}
        <button
          type="button"
          onClick={() => inst && onSelect(inst.instanceId)}
          className="shrink-0 bg-transparent border-none p-0 cursor-pointer"
          tabIndex={-1}
          aria-hidden
        >
          <AgentAvatar unit={agent.unitChoice} size={32} />
        </button>

        {/* Name + subtext — flex-1 */}
        <button
          type="button"
          onClick={() => inst && onSelect(inst.instanceId)}
          title={t("sidebar.row_open_chat_title")}
          className="flex-1 min-w-0 bg-transparent border-none text-left cursor-pointer p-0 text-inherit font-inherit"
        >
          <div className="text-[12.5px] font-medium text-txt overflow-hidden text-ellipsis whitespace-nowrap">
            {displayName}
          </div>
          <div className="text-[10.5px] text-txt-3 font-[var(--font-mono)] overflow-hidden text-ellipsis whitespace-nowrap">
            {instStatus === "idle"
              ? t("sidebar.status_ready")
              : instStatus === "done"
                ? t("sidebar.status_done", { label: agent.taskKind || t("sidebar.status_done_default") })
                : instStatus === "queued"
                  ? t("sidebar.status_queued")
                  : instStatus === "error"
                    ? t("sidebar.status_needs_attention")
                    : agent.task ?? instStatus}
          </div>
        </button>

        {/*
          Right-zone: at rest shows just the status dot.
          On group hover: dot fades, [+] and [×] appear.
          Fixed width so nothing shifts.
        */}
        <div className="relative shrink-0 flex items-center justify-end w-[52px] h-[20px]">
          {/* Dot — fades on hover */}
          <StatusDot
            status={instStatus}
            className="absolute right-0 transition-opacity duration-[120ms] group-hover:opacity-0"
          />
          {/* Action buttons — appear on hover */}
          <span className="absolute inset-0 flex items-center justify-end gap-[3px] opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSpawn(agent.id); }}
              aria-label={t("sidebar.spawn_instance_aria", { name: agent.name })}
              title={t("sidebar.spawn_instance_title")}
              className="w-[20px] h-[20px] bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 hover:text-acc hover:border-acc transition-colors duration-[100ms] cursor-pointer"
            >
              <Icon name="plus" size={10} />
            </button>
            {inst && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(inst.instanceId); }}
                aria-label={t("sidebar.remove_from_project_aria", { name: displayName })}
                title={t("sidebar.remove_from_project_title")}
                className="w-[20px] h-[20px] bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 hover:text-[var(--error)] hover:border-[var(--error)] transition-colors duration-[100ms] cursor-pointer"
              >
                <Icon name="x" size={10} />
              </button>
            )}
          </span>
        </div>
      </div>
    );
  }

  // ─── Multi-instance group ─────────────────────────────────────────────────
  const aggregated = aggregateStatus(instanceStatuses);
  const anyChildSelected = instances.some((i) => i.instanceId === selectedInstanceId);

  return (
    <div className="flex flex-col">
      {/* Group header row */}
      <div
        className={cn(
          "group relative flex items-center gap-[8px] rounded-[var(--r-sm)] hover:bg-bg-3 cursor-grab px-[8px] py-[6px]",
          anyChildSelected && !expanded ? "bg-acc-faint" : "",
        )}
        draggable
        onDragStart={(e) => {
          const dragRef: DragRef = { agentId: agent.id };
          e.dataTransfer.setData(AGENT_DRAG_MIME, JSON.stringify(dragRef));
          e.dataTransfer.setData("text/plain", agent.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(dragRef);
        }}
        onDragEnd={() => setDragging(null)}
      >
        {/* Avatar */}
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 bg-transparent border-none p-0 cursor-pointer"
          tabIndex={-1}
          aria-hidden
        >
          <AgentAvatar unit={agent.unitChoice} size={32} />
        </button>

        {/* Name + count — flex-1, clicking toggles group */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={t("sidebar.group_toggle_aria", { name: agent.name, count: instances.length })}
          className="flex-1 min-w-0 bg-transparent border-none text-left cursor-pointer p-0 text-inherit font-inherit flex items-center gap-[5px]"
        >
          <span className="text-[12.5px] font-medium text-txt overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            {agent.name}
          </span>
          <span className="shrink-0 text-[9.5px] text-txt-3 bg-bg-3 rounded-[3px] px-[4px] py-[1px] tabular-nums leading-none font-medium">
            {instances.length}
          </span>
        </button>

        {/*
          Right-zone: status dot at rest, [+] on hover.
          Chevron sits outside and is always visible.
        */}
        <div className="relative shrink-0 flex items-center justify-center w-[20px] h-[20px]">
          <StatusDot
            status={aggregated}
            className="transition-opacity duration-[120ms] group-hover:opacity-0"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSpawn(agent.id); }}
            aria-label={t("sidebar.spawn_instance_aria", { name: agent.name })}
            title={t("sidebar.spawn_instance_title")}
            className="absolute inset-0 bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 opacity-0 group-hover:opacity-100 hover:text-acc hover:border-acc transition-[opacity,colors] duration-[120ms] cursor-pointer"
          >
            <Icon name="plus" size={10} />
          </button>
        </div>

        {/* Chevron — always visible */}
        <Icon
          name="chevron-down"
          size={11}
          className={cn(
            "text-txt-4 transition-transform duration-[150ms] shrink-0",
            expanded ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </div>

      {/* Child rows */}
      {expanded && (
        <div className="flex flex-col mb-[2px] border-l-[2px] border-l-[rgba(255,240,230,0.15)] ml-[23px]">
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
        </div>
      )}
    </div>
  );
}
