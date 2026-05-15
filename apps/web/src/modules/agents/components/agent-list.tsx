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
    <div
      className="tab-pane"
      style={{
        padding: 18,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
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
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--txt-3)",
            fontSize: 13,
          }}
        >
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={onSearchChange} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--txt-3)",
          }}
        >
          {t("agent_list.shown_count", { visible, total })}
        </span>
      </div>

      {categories.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
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
    <label
      style={{
        position: "relative",
        flex: "1 1 320px",
        maxWidth: 480,
        display: "flex",
        alignItems: "center",
        height: 32,
        background: "var(--bg-1)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-1)",
        padding: "0 12px 0 32px",
        transition: "border-color 120ms",
      }}
    >
      <Icon
        name="search"
        size={14}
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--txt-3)",
          pointerEvents: "none",
        }}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("agent_list.search_placeholder")}
        aria-label={t("agent_list.search_aria")}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          font: "inherit",
          fontSize: 13,
          color: "var(--txt)",
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("agent_list.clear_search_aria")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--txt-3)",
            padding: 4,
            marginRight: -4,
            display: "inline-flex",
            borderRadius: 999,
          }}
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        border: `1px solid ${on ? "var(--acc)" : "var(--line)"}`,
        background: on ? "var(--acc-faint)" : "var(--bg-1)",
        color: on ? "var(--acc)" : "var(--txt-2)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {label}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          padding: "1px 6px",
          borderRadius: 999,
          background: on ? "rgba(233,84,32,0.18)" : "var(--bg-2)",
          color: on ? "var(--acc)" : "var(--txt-3)",
        }}
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
        <span className="last" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
