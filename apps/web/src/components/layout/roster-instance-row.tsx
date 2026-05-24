"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { AgentStatusInfo } from "@/modules/office/utils/derive-status";

export interface RosterInstanceRowProps {
  instanceId: string;
  instanceNumber: number;
  label?: string;
  status: AgentStatusInfo["status"];
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRename: () => void;
  isRenaming: boolean;
  onRenameCommit: (label: string) => void;
  onRenameCancel: () => void;
  spend?: number;
}

function StatusDot({ status, className }: { status: AgentStatusInfo["status"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-[7px] h-[7px] rounded-full shrink-0",
        status === "working" && "bg-[var(--working)] shadow-[0_0_0_3px_rgba(34,197,94,0.25)] animate-[pulseDot_1.8s_infinite_ease-in-out]",
        status === "done" && "bg-[var(--done)]",
        status === "queued" && "bg-[var(--queued)]",
        status === "error" && "bg-[var(--error)]",
        status === "thinking" && "bg-[var(--thinking)] animate-[pulseDot_1.8s_infinite_ease-in-out]",
        !["working", "done", "queued", "error", "thinking"].includes(status) && "bg-[var(--txt-4)]",
        className,
      )}
      title={status}
      aria-label={status}
    />
  );
}

export function RosterInstanceRow({
  instanceId,
  instanceNumber,
  label,
  status,
  isSelected,
  onSelect,
  onRemove,
  onRename,
  isRenaming,
  onRenameCommit,
  onRenameCancel,
  spend,
}: RosterInstanceRowProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const displayLabel = label || `Session ${instanceNumber}`;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onRenameCommit(inputRef.current?.value.trim() ?? "");
    else if (e.key === "Escape") onRenameCancel();
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-[6px] rounded-[var(--r-sm)] hover:bg-bg-3 px-[8px] pt-[4px] pb-[4px] min-h-[30px]",
        isSelected ? "bg-acc-faint" : "",
      )}
    >

      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          defaultValue={label ?? ""}
          onKeyDown={handleKeyDown}
          onBlur={() => onRenameCommit(inputRef.current?.value.trim() ?? "")}
          placeholder={`Session ${instanceNumber}`}
          aria-label={t("sidebar.rename_instance_aria", { number: instanceNumber })}
          className="flex-1 min-w-0 bg-bg-1 border border-line-2 rounded-[4px] px-[6px] py-[2px] text-[12px] text-txt outline-none focus:border-acc"
        />
      ) : (
        /* Select button — flex-1, no action buttons inside */
        <button
          type="button"
          onClick={onSelect}
          title={t("sidebar.row_open_chat_title")}
          className="flex-1 min-w-0 bg-transparent border-none text-left cursor-pointer p-0 text-inherit font-inherit overflow-hidden"
        >
          <span className="block text-[12px] text-txt-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {displayLabel}
          </span>
        </button>
      )}

      {/*
        Right-zone: fixed-width container.
        At rest  → spend pill (if any), transparent otherwise.
        On hover → [rename] [remove] buttons cross-fade in, pill fades out.
        Status dot always sits outside, to the right.
      */}
      {!isRenaming && (
        <div className="relative shrink-0 flex items-center justify-end w-[52px] h-[20px]">
          {/* Spend pill — fades on hover */}
          <span
            className="absolute inset-0 flex items-center justify-end pointer-events-none transition-opacity duration-[120ms] group-hover:opacity-0"
            aria-hidden={!spend}
          >
            {spend !== undefined && spend > 0 && (
              <span className="font-[var(--font-mono)] text-[10px] bg-bg-1 border border-line text-txt-3 rounded-full px-[5px] leading-[18px] whitespace-nowrap">
                ${spend.toFixed(2)}
              </span>
            )}
          </span>

          {/* Action buttons — fade in on hover */}
          <span className="absolute inset-0 flex items-center justify-end gap-[3px] opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRename(); }}
              aria-label={`Rename instance ${instanceNumber}`}
              title="Rename"
              className="w-[20px] h-[20px] bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 hover:text-txt hover:border-line-2 transition-colors duration-[100ms] cursor-pointer"
              data-instance-id={instanceId}
            >
              <Icon name="edit" size={9} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              aria-label={t("sidebar.remove_instance_aria", { number: instanceNumber, label: label ?? "" })}
              title={t("sidebar.remove_from_project_title")}
              className="w-[20px] h-[20px] bg-bg-1 border border-line rounded-full inline-flex items-center justify-center text-txt-3 hover:text-[var(--error)] hover:border-[var(--error)] transition-colors duration-[100ms] cursor-pointer"
              data-instance-id={instanceId}
            >
              <Icon name="x" size={10} />
            </button>
          </span>
        </div>
      )}

      {/* Status dot — always visible outside the action zone */}
      {!isRenaming && <StatusDot status={status} />}
    </div>
  );
}
