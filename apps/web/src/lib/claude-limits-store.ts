import { useEffect } from "react";
import { create } from "zustand";

export type ClaudePlan = "free" | "pro" | "max" | "api" | "custom";
export type LimitsPeriod = "daily" | "week" | "month";

export interface ClaudeLimits {
  plan: ClaudePlan;
  /** Dollar cap for the period. 0 means "no quota set - just track usage". */
  quotaUsd: number;
  period: LimitsPeriod;
  hardCap: "off" | "warn" | "block";
}

const DEFAULTS: ClaudeLimits = { plan: "free", quotaUsd: 0, period: "week", hardCap: "warn" };

type LimitsState = ClaudeLimits & {
  open: boolean;
  hydrated: boolean;
  setOpen: (next: boolean) => void;
  /** Update user-configurable settings only (plan is read-only — sourced from credentials). */
  update: (patch: Omit<Partial<ClaudeLimits>, "plan">) => void;
  hydrate: () => void;
};

function validPlan(p: unknown): p is ClaudePlan {
  return p === "free" || p === "pro" || p === "max" || p === "api" || p === "custom";
}

function validHardCap(v: unknown): v is "off" | "warn" | "block" {
  return v === "off" || v === "warn" || v === "block";
}

function parseLimits(raw: string): ClaudeLimits {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Migrate legacy max-5x / max-20x values
    let plan: ClaudePlan;
    if (parsed.plan === "max-5x" || parsed.plan === "max-20x") {
      plan = "max";
    } else {
      plan = validPlan(parsed.plan) ? parsed.plan : DEFAULTS.plan;
    }

    const period: LimitsPeriod =
      parsed.period === "month" ? "month" :
      parsed.period === "daily" ? "daily" :
      "week";

    const hardCap = validHardCap(parsed.hardCap) ? parsed.hardCap : DEFAULTS.hardCap;

    return {
      plan,
      quotaUsd: typeof parsed.quotaUsd === "number" && parsed.quotaUsd >= 0 ? parsed.quotaUsd : DEFAULTS.quotaUsd,
      period,
      hardCap,
    };
  } catch {
    return DEFAULTS;
  }
}

export const useClaudeLimitsStore = create<LimitsState>((set, get) => ({
  ...DEFAULTS,
  open: false,
  hydrated: false,
  setOpen: (next) => set({ open: next }),
  update: (patch) => {
    const merged = { ...get(), ...patch };
    set(merged);
    // Persist only user-configurable fields (plan comes from credentials, not stored here)
    const toSave = { quotaUsd: merged.quotaUsd, period: merged.period, hardCap: merged.hardCap };
    fetch("/api/ui-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "claude-limits": JSON.stringify(toSave) }),
    }).catch(() => { /* best-effort */ });
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    // Load user settings and real plan in parallel
    Promise.all([
      fetch("/api/ui-settings").then((r) => r.json() as Promise<Record<string, string>>),
      fetch("/api/account").then((r) => r.json() as Promise<{ plan: ClaudePlan }>),
    ])
      .then(([settings, account]) => {
        const stored = settings["claude-limits"];
        const limits = stored ? parseLimits(stored) : DEFAULTS;
        // Real plan from credentials always wins
        set({ ...limits, plan: account.plan });
      })
      .catch(() => { /* ignore */ });
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
    case "free": return "Free";
    case "pro": return "Pro";
    case "max": return "Max";
    case "api": return "API";
    case "custom": return "Custom";
  }
}

/** Start-of-period timestamp for filtering runs. */
export function periodStart(period: LimitsPeriod, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "month") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (period === "daily") return d.getTime();
  // week - start on Monday (ISO)
  const dow = d.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

/** End-of-period timestamp - exclusive upper bound for the current window. */
export function periodEnd(period: LimitsPeriod, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "month") return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  if (period === "daily") {
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return periodStart(period, now) + 7 * 86_400_000;
}
