"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { useOfficeStore } from "@/modules/office/hooks/use-office-store";
import { useRuns } from "@/modules/runs/hooks/use-runs";
import { paletteForAgent } from "@/modules/office/utils/sprite-palette";
import type { ApiAgent } from "@agent-office/shared/types";
import { useAgents } from "../hooks/use-agents";
import { useAgentFilter } from "../hooks/use-agent-filter";
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
    return (
      <div className="tab-pane" style={{ padding: 18 }}>
        <Skeleton width={320} height={36} />
        <div style={{ height: 12 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={148} />
          ))}
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <EmptyState
        icon="users"
        title={t("common.empty")}
        description="Drop a markdown file in ~/.claude/agents/ or click 'New agent'."
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
          No agents match the current filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
            alignContent: "start",
          }}
        >
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search by name, description, skill, or tool…"
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--txt-3)",
          }}
        >
          {visible} / {total} shown
        </span>
      </div>

      {categories.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <FilterChip
            label="All"
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
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
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
        placeholder={placeholder}
        aria-label="Search agents"
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
          aria-label="Clear search"
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
  const sprite = paletteForAgent(agent.name);
  const category = categorize(agent);
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        padding: 16,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "linear-gradient(135deg, var(--yaru-orange), var(--yaru-purple))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <PixelSprite agent={sprite} size={32} animate={false} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>{agent.name}</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--txt-3)",
            }}
          >
            {category}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label={`Edit ${agent.name}`}
          title="Open settings"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--txt-3)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "inline-flex",
          }}
        >
          <Icon name="edit" size={14} />
        </button>
      </div>

      <div
        style={{
          fontSize: 12.5,
          color: "var(--txt-2)",
          lineHeight: 1.5,
          minHeight: 38,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {agent.description || "—"}
      </div>

      {agent.skills.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {agent.skills.slice(0, 3).map((s) => (
            <span key={s} className="tag skill">#{s}</span>
          ))}
          {agent.skills.length > 3 ? (
            <span className="tag">+{agent.skills.length - 3}</span>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
        }}
      >
        <span className="tag">{agent.defaultModel ?? "default"}</span>
        <span
          style={{
            fontSize: 11,
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="activity" size={11} /> {uses} use{uses === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
