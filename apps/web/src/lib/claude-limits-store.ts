import { useEffect } from "react";
import { create } from "zustand";

export type ClaudePlan = "pro" | "max-5x" | "max-20x" | "api" | "custom";
export type LimitsPeriod = "week" | "month";

export interface ClaudeLimits {
  plan: ClaudePlan;
  /** Dollar cap for the period. 0 means "no quota set — just track usage". */
  quotaUsd: number;
  period: LimitsPeriod;
}

const DEFAULTS: ClaudeLimits = {
  plan: "pro",
  quotaUsd: 0,
  period: "week",
};

const STORAGE_KEY = "agent-office:claude-limits";

type LimitsState = ClaudeLimits & {
  open: boolean;
  hydrated: boolean;
  setOpen: (next: boolean) => void;
  update: (patch: Partial<ClaudeLimits>) => void;
  hydrate: () => void;
};

function readStored(): ClaudeLimits {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ClaudeLimits>;
    return {
      plan: validPlan(parsed.plan) ? parsed.plan! : DEFAULTS.plan,
      quotaUsd: typeof parsed.quotaUsd === "number" && parsed.quotaUsd >= 0 ? parsed.quotaUsd : DEFAULTS.quotaUsd,
      period: parsed.period === "month" ? "month" : "week",
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(limits: ClaudeLimits) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

function validPlan(p: unknown): p is ClaudePlan {
  return p === "pro" || p === "max-5x" || p === "max-20x" || p === "api" || p === "custom";
}

export const useClaudeLimitsStore = create<LimitsState>((set, get) => ({
  ...DEFAULTS,
  open: false,
  hydrated: false,
  setOpen: (next) => set({ open: next }),
  update: (patch) => {
    const current: ClaudeLimits = {
      plan: get().plan,
      quotaUsd: get().quotaUsd,
      period: get().period,
    };
    const merged: ClaudeLimits = { ...current, ...patch };
    persist(merged);
    set(merged);
  },
  hydrate: () => {
    if (get().hydrated) return;
    const stored = readStored();
    set({ ...stored, hydrated: true });
  },
}));

export function useClaudeLimitsHydration() {
  const hydrate = useClaudeLimitsStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}

export function planLabel(plan: ClaudePlan): string {
  switch (plan) {
    case "pro":
      return "Pro";
    case "max-5x":
      return "Max 5×";
    case "max-20x":
      return "Max 20×";
    case "api":
      return "API";
    case "custom":
      return "Custom";
  }
}

/** Start-of-period timestamp for filtering runs. */
export function periodStart(period: LimitsPeriod, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "month") {
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  // week — start on Monday (ISO)
  const dow = d.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

/** End-of-period timestamp — exclusive upper bound for the current window. */
export function periodEnd(period: LimitsPeriod, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "month") {
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }
  const start = periodStart(period, now);
  return start + 7 * 86_400_000;
}
