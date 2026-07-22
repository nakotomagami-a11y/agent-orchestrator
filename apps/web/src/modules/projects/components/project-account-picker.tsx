"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, type DropdownItem } from "@/components/ui/dropdown-menu";
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

  const items: DropdownItem[] = accountsQ.data.map((a) => ({
    key: a.id,
    label: (
      <span className="flex items-center gap-[8px]">
        <span>{a.label}</span>
        <PlanBadge plan={a.plan} className="h-[14px] text-[9px] px-[4px]" />
      </span>
    ),
    onSelect: () => handleChange(a.id),
  }));

  return (
    <div className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3">
      <Icon name="users" size={11} className="shrink-0" />
      <DropdownMenu
        align="start"
        ariaLabel="Select account"
        triggerClassName="!h-[22px] !px-[8px] !text-[11px] !text-txt-3 hover:!text-txt"
        trigger={
          <span className="flex items-center gap-[6px]">
            <span>{activeAccount?.label ?? "Default"}</span>
            <Icon name="chevron-down" size={10} className="shrink-0" />
          </span>
        }
        items={items}
      />
      {activeAccount ? <PlanBadge plan={activeAccount.plan} className="h-[14px] text-[9px] px-[4px]" /> : null}
    </div>
  );
}
