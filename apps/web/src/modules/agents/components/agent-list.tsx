"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { AgentListGhost } from "./agent-list-ghost";
import { Icon } from "@/components/ui/icon";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { unitForAgent } from "@/components/ui/unit-sprite.utils";
import { cn } from "@/lib/cn";
import { useOfficeStore } from "@/modules/office/hooks/use-office-store";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import type { ApiAgent } from "@agent-office/shared/types";
import { useAgents } from "../hooks/use-agents";
import { categorize, tallyCategories } from "../utils/categorize";

/**
 * Agent gallery. Card grid styled after the v3 `TemplatesView`, with a
 * search box and category chips (derived from `room` or a name-prefix
 * heuristic in `categorize.ts`). Clicking a card opens the global agent
 * details modal so chat and settings stay inline.
 */
export function AgentList() {
  const t = useTranslations();
  const { data, isLoading } = useAgents();
  const runsQ = useRuns({ limit: 500 });
  const select = useOfficeStore((s) => s.select);

  const [search, setSearch] = useState("");
  const [activeCats, setActiveCats] = useState<Set<string>>(() => new Set());

  const agents = data ?? [];
  const categories = useMemo(() => {
    const tally = tallyCategories(agents);
    return Object.entries(tally).sort((a, b) => b[1] - a[1]);
  }, [agents]);

  const usesByAgent = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of runsQ.data ?? []) {
      m[r.agentId] = (m[r.agentId] ?? 0) + 1;
    }
    return m;
  }, [runsQ.data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (activeCats.size > 0 && !activeCats.has(categorize(a))) return false;
      if (!q) return true;
      if (a.name.toLowerCase().includes(q)) return true;
      if (a.description?.toLowerCase().includes(q)) return true;
      if (a.skills?.some((s) => s.toLowerCase().includes(q))) return true;
      if (a.tools?.some((tl) => tl.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [agents, search, activeCats]);

  const toggleCat = (cat: string) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (isLoading) {
    return <AgentListGhost />;
  }

  if (agents.length === 0) {
    return (
      <EmptyState
        icon="users"
        title={t("common.empty")}
        description={t("agent_list.empty_hint")}
      />
    );
  }

  return (
    <div className="tab-pane p-[18px] overflow-auto flex flex-col gap-[14px]">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        categories={categories}
        active={activeCats}
        onToggle={toggleCat}
        onClear={() => setActiveCats(new Set())}
        total={agents.length}
        visible={visible.length}
      />

      {visible.length === 0 ? (
        <div className="p-8 text-center text-txt-3 text-[13px]">
          {t("agent_list.no_matches")}
        </div>
      ) : (
        <div className="of-grid">
          {visible.map((a) => (
            <AgentCard
              key={a.name}
              agent={a}
              uses={usesByAgent[a.name] ?? 0}
              onOpen={() => select(a.name)}
              onEdit={() => select(a.name, { tab: "settings" })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  search,
  onSearchChange,
  categories,
  active,
  onToggle,
  onClear,
  total,
  visible,
}: {
  search: string;
  onSearchChange: (next: string) => void;
  categories: Array<[string, number]>;
  active: Set<string>;
  onToggle: (cat: string) => void;
  onClear: () => void;
  total: number;
  visible: number;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-center gap-[10px] flex-wrap">
        <SearchInput value={search} onChange={onSearchChange} />
        <span className="font-mono text-[11px] text-txt-3">
          {t("agent_list.shown_count", { visible, total })}
        </span>
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-[6px] items-center">
          <FilterChip
            label={t("agent_list.filter_all")}
            count={total}
            on={active.size === 0}
            onClick={onClear}
          />
          {categories.map(([cat, count]) => (
            <FilterChip
              key={cat}
              label={cat}
              count={count}
              on={active.has(cat)}
              onClick={() => onToggle(cat)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations();
  return (
    <label className="relative [flex:1_1_320px] max-w-[480px] flex items-center h-8 bg-bg-1 border border-line-2 rounded-md shadow-1 px-3 pl-8 transition-colors duration-[120ms]">
      <Icon
        name="search"
        size={14}
        className="absolute left-[10px] top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("agent_list.search_placeholder")}
        aria-label={t("agent_list.search_aria")}
        className="w-full bg-transparent border-none outline-none font-[inherit] text-[13px] text-txt"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("agent_list.clear_search_aria")}
          className="bg-transparent border-none cursor-pointer text-txt-3 p-1 -mr-1 inline-flex rounded-full"
        >
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </label>
  );
}

function FilterChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-[6px] py-[5px] px-[10px] rounded-full text-xs font-medium cursor-pointer font-[inherit]",
        on
          ? "border border-acc bg-acc-faint text-acc"
          : "border border-line bg-bg-1 text-txt-2",
      )}
    >
      {label}
      <span
        className={cn(
          "font-mono text-[10.5px] px-[6px] py-[1px] rounded-full",
          on ? "text-acc" : "bg-bg-2 text-txt-3",
        )}
        style={on ? { background: "rgba(233,84,32,0.18)" } : undefined}
      >
        {count}
      </span>
    </button>
  );
}

function AgentCard({
  agent,
  uses,
  onOpen,
  onEdit,
}: {
  agent: ApiAgent;
  uses: number;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations();
  const unit = unitForAgent(agent.name, agent.unit);
  const category = categorize(agent);
  const catColor = categoryColor(category);
  const modelColor =
    (agent.defaultModel ?? "").includes("haiku") ? "var(--done)" :
    (agent.defaultModel ?? "").includes("opus") ? "#ffcb6b" :
    "#c792ea";

  return (
    <div
      className="of-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onOpen()}
    >
      <div className="head-row">
        <div className="av">
          <AgentAvatar unit={unit} size={42} />
        </div>
        <div className="name-blk">
          <div className="name">{agent.name}</div>
          <div className="slug">{agent.name}</div>
        </div>
        <span
          className="status-chip"
          style={{
            background: `color-mix(in srgb, ${catColor} 12%, var(--bg-2))`,
            border: `1px solid color-mix(in srgb, ${catColor} 30%, transparent)`,
            color: catColor,
          }}
        >
          {category}
        </span>
      </div>

      <div className="state-box">
        <div className="label">about</div>
        <div className={cn("text", !agent.description && "muted")}>
          {agent.description || t("agent_list.description_empty")}
        </div>
      </div>

      <div className="foot-row">
        <span className="meta-pill">
          <span className="d" style={{ background: modelColor }} />
          {agent.defaultModel ?? t("agent_list.model_default")}
        </span>
        <span className="last inline-flex items-center gap-1">
          <Icon name="activity" size={10} /> {t("agent_list.uses_count", { count: uses })}
        </span>
      </div>

      <div className="of-card-actions">
        <button
          type="button"
          className="primary"
          onClick={e => { e.stopPropagation(); onOpen(); }}
        >
          <Icon name="send" size={11} /> Open
        </button>
        <button
          type="button"
          title={t("agent_list.edit_title")}
          aria-label={t("agent_list.edit_aria", { name: agent.name })}
          onClick={e => { e.stopPropagation(); onEdit(); }}
        >
          <Icon name="edit" size={13} />
        </button>
      </div>
    </div>
  );
}

function categoryColor(cat: string): string {
  const m: Record<string, string> = {
    Engineering: "#3b82f6", QA: "#10b981", Design: "#ec4899",
    "AI & Data": "#8b5cf6", Security: "#ef4444", Docs: "#f59e0b",
    Marketing: "#f97316", Research: "#06b6d4", Strategy: "#8b5cf6",
    Build: "#e95420",
  };
  return m[cat] ?? "#8A8079";
}
