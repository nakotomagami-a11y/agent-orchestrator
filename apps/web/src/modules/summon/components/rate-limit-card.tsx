"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useClaudeLimitsStore, periodStart, periodEnd } from "@/lib/claude-limits-store";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { formatCountdown } from "../format/format-countdown";

export type RateLimitCardProps = {
  message: string;
  resetsAt?: number;
  onStop?: () => void;
  onDismiss?: () => void;
};

/**
 * Warning card shown in the chat thread when Claude returns a rate-limit
 * error. Displays current budget usage, a live countdown to reset, and
 * gives the user two actions: stop the run or continue (dismiss and let
 * the retry happen automatically).
 */
export function RateLimitCard({ message, resetsAt, onStop, onDismiss }: RateLimitCardProps) {
  const usageLabel = useRateLimitUsageLabel();
  const secsLeft = useRateLimitCountdown(resetsAt);
  return (
    <div className="border border-[rgba(234,179,8,0.30)] border-l-[3px] border-l-[#ca8a04] rounded-[8px] px-[14px] py-3 bg-[rgba(234,179,8,0.05)] flex items-start gap-[10px]">
      <RateLimitIcon />
      <div className="flex-1 min-w-0">
        <RateLimitHeader usageLabel={usageLabel} />
        <div className="text-ao-fg-1 text-[12.5px] mt-0.5 font-mono leading-[1.5]">{message}</div>
        {secsLeft !== null && secsLeft > 0 ? (
          <div className="mt-[4px] font-mono text-[11.5px] text-ao-fg-3">
            Resets in <span className="text-[#ca8a04]">{formatCountdown(secsLeft)}</span>
          </div>
        ) : null}
        <RateLimitActions onStop={onStop} onDismiss={onDismiss} />
      </div>
    </div>
  );
}

/**
 * Compute the current billing-period label ("used 42%" or "$0.83 spent")
 * from the runs store and the configured Claude limits.
 */
function useRateLimitUsageLabel(): string {
  const quotaUsd = useClaudeLimitsStore((s) => s.quotaUsd);
  const period = useClaudeLimitsStore((s) => s.period);
  const runsQ = useRuns({ limit: 500 });
  const allRuns = useMemo(() => runsQ.data ?? [], [runsQ.data]);
  return useMemo(() => {
    const start = periodStart(period);
    const end = periodEnd(period);
    const cost = allRuns.filter((r) => r.ts >= start && r.ts < end).reduce((s, r) => s + (r.cost || 0), 0);
    if (quotaUsd > 0) {
      const pct = Math.round((cost / quotaUsd) * 100);
      return `used ${pct}%`;
    }
    return `$${cost.toFixed(2)} spent`;
  }, [allRuns, quotaUsd, period]);
}

/** Second-precision live countdown driven by resetsAt (unix seconds). */
function useRateLimitCountdown(resetsAt: number | undefined): number | null {
  const [secsLeft, setSecsLeft] = useState<number | null>(
    resetsAt ? Math.max(0, resetsAt - Math.floor(Date.now() / 1000)) : null,
  );
  useEffect(() => {
    if (secsLeft === null || secsLeft <= 0) return;
    const id = setInterval(() => setSecsLeft((s) => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [secsLeft]);
  return secsLeft;
}

function RateLimitIcon() {
  return (
    <div className="w-[22px] h-[22px] flex items-center justify-center rounded-[6px] bg-[rgba(234,179,8,0.12)] text-[#ca8a04] shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
  );
}

function RateLimitHeader({ usageLabel }: { usageLabel: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-semibold text-ao-fg-0 text-[13.5px]">Rate limited</span>
      <span className="font-mono text-[11px] px-[6px] py-[2px] rounded-full bg-[rgba(234,179,8,0.12)] text-[#ca8a04]">{usageLabel}</span>
    </div>
  );
}

function RateLimitActions({ onStop, onDismiss }: { onStop: (() => void) | undefined; onDismiss: (() => void) | undefined }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        onClick={onStop}
        disabled={!onStop}
        className="text-[var(--ao-bad)] text-[12px] cursor-pointer inline-flex items-center gap-1 bg-transparent border-0 p-0 disabled:opacity-40 disabled:cursor-default"
      >
        <Icon name="stop" size={11} /> Stop agent
      </button>
      <button
        onClick={onDismiss}
        disabled={!onDismiss}
        className="text-[#ca8a04] text-[12px] cursor-pointer inline-flex items-center gap-1 bg-transparent border-0 p-0 disabled:opacity-40 disabled:cursor-default"
      >
        <Icon name="refresh" size={11} /> Continue
      </button>
    </div>
  );
}
