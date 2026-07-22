"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, type DropdownItem } from "@/components/ui/dropdown-menu";
import { PAGE_ROUTES } from "@agent-office/domain/config/routes";
import { useGithubAccounts } from "@/modules/github-accounts/hooks/use-github-accounts";
import { useUpdateProject } from "../hooks/use-projects";

/**
 * Per-project GitHub account picker — chip in the project detail meta row.
 *
 * `undefined` githubAccountId = the "default" account (system gh auth, no
 * `GH_CONFIG_DIR` injection). Selecting "Default" sends `githubAccountId: null`
 * to the API, which the projects service coerces to undefined and removes from
 * the frontmatter.
 */
export function ProjectGithubAccountPicker({
  projectId,
  currentGithubAccountId,
}: {
  projectId: string;
  currentGithubAccountId?: string | undefined;
}) {
  const accountsQ = useGithubAccounts();
  const update = useUpdateProject();

  const activeId = currentGithubAccountId ?? "default";
  const activeAccount = accountsQ.data?.find((a) => a.id === activeId);

  const handleChange = (nextId: string) => {
    const githubAccountId = nextId === "default" ? null : nextId;
    update.mutate({ id: projectId, patch: { meta: { githubAccountId } } });
  };

  const usernameChip = (username: string | undefined) =>
    username ? <span className="text-txt-3">@{username}</span> : null;

  // No account data yet → render a static chip so the header layout doesn't jump.
  if (!accountsQ.data) {
    return (
      <div className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3">
        <Icon name="branch" size={11} className="shrink-0" />
        <span>github…</span>
      </div>
    );
  }

  // Only one account (the default) — render as a link to Settings, no dropdown.
  if (accountsQ.data.length <= 1) {
    return (
      <Link
        href={PAGE_ROUTES.settings}
        className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3 hover:text-txt no-underline"
        title="Add more GitHub accounts in Settings"
      >
        <Icon name="branch" size={11} className="shrink-0" />
        <span>{activeAccount?.label ?? "Default"}</span>
        {usernameChip(activeAccount?.username)}
      </Link>
    );
  }

  const items: DropdownItem[] = accountsQ.data.map((a) => ({
    key: a.id,
    label: (
      <span className="flex items-center gap-[8px]">
        <span>{a.label}</span>
        {a.username ? <span className="text-txt-3 font-mono text-[10.5px]">@{a.username}</span> : null}
      </span>
    ),
    onSelect: () => handleChange(a.id),
  }));

  return (
    <div className="flex items-center gap-[6px] font-[var(--font-mono)] text-[11px] text-txt-3">
      <Icon name="branch" size={11} className="shrink-0" />
      <DropdownMenu
        align="start"
        ariaLabel="Select GitHub account"
        trigger={
          <span className="flex items-center gap-[6px]">
            <span>{activeAccount?.label ?? "Default"}</span>
            <Icon name="chevron-down" size={10} className="shrink-0" />
          </span>
        }
        items={items}
      />
      {usernameChip(activeAccount?.username)}
    </div>
  );
}
