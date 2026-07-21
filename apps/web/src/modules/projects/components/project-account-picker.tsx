"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { PAGE_ROUTES } from "@agent-office/domain/config/routes";
import { useAccounts } from "@/modules/accounts/hooks/use-accounts";
import { PlanBadge } from "@/modules/accounts/components/plan-badge";
import { useUpdateProject } from "../hooks/use-projects";

/**
 * Per-project account picker — chip in the project detail meta row.
 *
 * `undefined` accountId = the "default" account (i.e. `~/.claude`). Selecting
 * "Default" from the dropdown sends `accountId: null` to the API, which the
 * projects service coerces to undefined and removes from the frontmatter.
 */
export function ProjectAccountPicker({
  projectId,
  currentAccountId,
}: {
  projectId: string;
  currentAccountId?: string | undefined;
}) {
  const accountsQ = useAccounts();
  const update = useUpdateProject();

  const activeId = currentAccountId ?? "default";
  const activeAccount = accountsQ.data?.find((a) => a.id === activeId);

  const handleChange = (nextId: string) => {
    const accountId = nextId === "default" ? null : nextId;
    update.mutate({ id: projectId, patch: { meta: { accountId } } });
  };

  // No account data yet → render a static chip so the header layout doesn't jump.
  if (!accountsQ.data) {
    return (
      <div className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3">
        <Icon name="users" size={11} className="shrink-0" />
        <span>account…</span>
      </div>
    );
  }

  // Only one account (the default) — render as a link to Settings, no dropdown.
  if (accountsQ.data.length <= 1) {
    return (
      <Link
        href={PAGE_ROUTES.settings}
        className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3 hover:text-txt no-underline"
        title="Add more accounts in Settings"
      >
        <Icon name="users" size={11} className="shrink-0" />
        <span>{activeAccount?.label ?? "Default"}</span>
        {activeAccount ? <PlanBadge plan={activeAccount.plan} className="h-[14px] text-[9px] px-[4px]" /> : null}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3">
      <Icon name="users" size={11} className="shrink-0" />
      <Select
        value={activeId}
        onChange={(e) => handleChange(e.target.value)}
        className="!h-[22px] !text-[11px] !pl-[8px] !pr-[22px] !py-0 !bg-transparent !border-line !text-txt-3 hover:!text-txt"
        disabled={update.isPending}
      >
        {accountsQ.data.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label} · {a.plan}
          </option>
        ))}
      </Select>
      {activeAccount ? <PlanBadge plan={activeAccount.plan} className="h-[14px] text-[9px] px-[4px]" /> : null}
    </div>
  );
}
