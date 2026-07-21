"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/domain/hooks/api";
import { queryKeys } from "@agent-office/domain/hooks/query-keys";
import { API_ROUTES } from "@agent-office/domain/config/routes";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { QueryState } from "@/components/ui/query-state";
import { useAccounts } from "../hooks/use-accounts";

/**
 * Per-account activity rollup. Placeholder visual — the spec explicitly
 * defers the real analytics design to a designer session. This panel exists
 * to prove the data pipeline (runs.account_id → grouped analytics) works.
 */

interface AccountStats {
  accountId: string | null;
  runs24h: number;
  runs7d: number;
  runsAllTime: number;
  cost7dUsd: number;
}

export function AccountsStatsPanel() {
  const accountsQ = useAccounts();
  const statsQ = useQuery({
    queryKey: queryKeys.analytics.perAccount(),
    queryFn: () => apiFetch<AccountStats[]>(API_ROUTES.analyticsPerAccount),
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    if (!accountsQ.data || !statsQ.data) return [];
    return accountsQ.data.map((account) => {
      // Legacy rows with NULL account_id belong to the default account.
      const stats =
        statsQ.data.find((s) => s.accountId === account.id) ??
        (account.id === "default"
          ? statsQ.data.find((s) => s.accountId === null)
          : null) ??
        emptyStats(account.id);
      return { account, stats };
    });
  }, [accountsQ.data, statsQ.data]);

  return (
    <Card>
      <CardHeader
        title="Usage per account"
        sub="Temporary — will be redesigned with the designer agent."
      />
      <div className="p-4">
        <QueryState result={statsQ} loading={<div className="text-[12px] text-txt-3">Loading…</div>}>
          {() => (
            <div className="flex flex-col gap-[6px]">
              <div className="flex items-center gap-[16px] px-[10px] text-[10.5px] text-txt-4 font-mono uppercase tracking-[0.06em]">
                <span className="flex-1">Account</span>
                <span className="w-[70px] text-right">Runs 24h</span>
                <span className="w-[70px] text-right">Runs 7d</span>
                <span className="w-[80px] text-right">All time</span>
                <span className="w-[90px] text-right">Cost 7d</span>
              </div>
              {rows.length === 0 ? (
                <div className="text-[13px] text-txt-3 px-2 py-4">No runs recorded yet.</div>
              ) : (
                rows.map(({ account, stats }) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-[16px] px-[10px] py-[8px] rounded-[8px] bg-bg-2 border border-line"
                  >
                    <span className="flex-1 text-[13px] text-txt truncate">{account.label}</span>
                    <span className="w-[70px] text-right font-mono text-[12px] text-txt">{stats.runs24h}</span>
                    <span className="w-[70px] text-right font-mono text-[12px] text-txt">{stats.runs7d}</span>
                    <span className="w-[80px] text-right font-mono text-[12px] text-txt">{stats.runsAllTime}</span>
                    <span className="w-[90px] text-right font-mono text-[12px] text-txt">
                      ${stats.cost7dUsd.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </QueryState>
      </div>
    </Card>
  );
}

function emptyStats(accountId: string): AccountStats {
  return { accountId, runs24h: 0, runs7d: 0, runsAllTime: 0, cost7dUsd: 0 };
}
