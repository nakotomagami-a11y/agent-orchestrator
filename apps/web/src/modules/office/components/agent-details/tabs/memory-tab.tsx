"use client";

import { useState, useEffect } from "react";
import type React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentMemory, useWriteAgentMemory } from "@/modules/agents/hooks/use-agents";
import {
  AoBook, AoPlus, AoTrash, AoCheck, AoSearch, AoCode,
} from "@/modules/summon/components/ao-icons";

type Fact = { id: string; k: string; v: string };
type Group = { key: string; facts: Fact[] };

function parseMemory(raw: string): Group[] {
  const lines = raw.split("\n");
  const groups: Group[] = [];
  let current: Group | undefined;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const groupMatch = line.match(/^([a-zA-Z0-9_-]+):\s*$/);
    if (groupMatch) {
      const key = groupMatch[1] ?? "";
      current = { key, facts: [] };
      groups.push(current);
      continue;
    }
    const factMatch = line.match(/^\s{1,}([^:]+?)\s*:\s*(.*)$/);
    if (factMatch && current) {
      const k = factMatch[1]?.trim() ?? "";
      const v = factMatch[2]?.trim() ?? "";
      current.facts.push({ id: `${current.key}_${k}_${groups.length}`, k, v });
    }
  }
  return groups;
}

function serializeMemory(groups: Group[]): string {
  return groups.map((g) => {
    const lines = [`${g.key}:`];
    for (const f of g.facts) {
      if (f.k) lines.push(`  ${f.k}: ${f.v}`);
    }
    return lines.join("\n");
  }).join("\n\n");
}

export function MemoryTab({ agentId, discardRef }: { agentId: string; discardRef?: React.MutableRefObject<(() => void) | null> }) {
  const memQ = useAgentMemory(agentId);
  const writeMem = useWriteAgentMemory();
  const [groups, setGroups] = useState<Group[]>([]);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (memQ.data !== undefined) {
      setGroups(parseMemory(memQ.data));
      setDirty(false);
    }
  }, [memQ.data]);

  if (memQ.isLoading) {
    return (
      <div className="ao-tab-pane">
        <Skeleton width="100%" height={180} />
      </div>
    );
  }

  const totalFacts = groups.reduce((s, g) => s + g.facts.length, 0);

  const updateFact = (gi: number, fi: number, patch: Partial<Fact>) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gi ? { ...g, facts: g.facts.map((f, j) => (j === fi ? { ...f, ...patch } : f)) } : g
      )
    );
    setDirty(true);
  };

  const removeFact = (gi: number, fi: number) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gi ? { ...g, facts: g.facts.filter((_, j) => j !== fi) } : g
      )
    );
    setDirty(true);
  };

  const addFact = (gi: number) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gi ? { ...g, facts: [...g.facts, { id: `new_${Date.now()}`, k: "", v: "" }] } : g
      )
    );
    setDirty(true);
  };

  const removeGroup = (gi: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== gi));
    setDirty(true);
  };

  const addGroup = () => {
    setGroups((prev) => [...prev, { key: `group_${prev.length + 1}`, facts: [] }]);
    setDirty(true);
  };

  const handleSave = async () => {
    await writeMem.mutateAsync({ id: agentId, content: serializeMemory(groups) });
    setDirty(false);
  };

  const handleDiscard = () => {
    if (memQ.data !== undefined) {
      setGroups(parseMemory(memQ.data));
      setDirty(false);
    }
  };

  useEffect(() => {
    if (discardRef) discardRef.current = handleDiscard;
  });

  const matches = (g: Group, f: Fact) => {
    if (!q) return true;
    return `${g.key} ${f.k} ${f.v}`.toLowerCase().includes(q.toLowerCase());
  };

  return (
    <div className="ao-tab-pane">
      {/* Header card */}
      <div className="ao-card mb-[14px]">
        <div className="ao-card-header">
          <div className="ao-icon"><AoBook size={15} /></div>
          <div>
            <div className="ao-title">Memory</div>
            <div className="ao-sub mt-[2px]">
              facts carried into every conversation · {totalFacts} facts across {groups.length} groups
            </div>
          </div>
          <div className="ml-auto flex gap-2 items-center">
            <span className="ao-badge ao-neutral">YAML</span>
            <button type="button" className="ao-btn-mini" onClick={() => setShowRaw(!showRaw)}>
              <AoCode size={13} /> {showRaw ? "Structured" : "View raw"}
            </button>
          </div>
        </div>
      </div>

      {showRaw ? (
        <textarea
          readOnly
          value={memQ.data ?? ""}
          className="w-full min-h-[300px] bg-[var(--ao-bg-2)] text-[var(--ao-fg-1)] border border-[var(--ao-line-1)] rounded-[var(--ao-radius-md)] p-[14px] font-[var(--ao-font-mono)] text-[12.5px] outline-none resize-y"
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className="ao-mem-toolbar">
            <div className="ao-search-input flex-1">
              <AoSearch size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search facts…" />
            </div>
            <button type="button" className="ao-btn-mini" onClick={addGroup}>
              <AoPlus size={13} /> Add group
            </button>
          </div>

          {/* Groups */}
          {groups.length === 0 ? (
            <div className="ao-card">
              <div className="ao-card-body !text-center !p-8 !text-[var(--ao-fg-2)]">
                <AoBook size={28} />
                <div className="mt-2 text-[13px]">No memory yet.</div>
                <button type="button" className="ao-btn-mini mt-3" onClick={addGroup}>
                  <AoPlus size={13} /> Add first group
                </button>
              </div>
            </div>
          ) : (
            groups.map((g, gi) => {
              const visible = g.facts.filter((f) => matches(g, f));
              if (q && visible.length === 0) return null;
              return (
                <div key={`${g.key}_${gi}`} className="ao-mem-section">
                  <div className="ao-mem-section-header">
                    <span className="ao-name">{g.key}:</span>
                    <span className="ao-count">{g.facts.length} {g.facts.length === 1 ? "fact" : "facts"}</span>
                    <div className="ao-actions">
                      <button
                        type="button"
                        aria-label="Delete group"
                        className="ao-danger"
                        onClick={() => removeGroup(gi)}
                      >
                        <AoTrash size={13} />
                      </button>
                    </div>
                  </div>
                  {visible.map((f) => {
                    const fi = g.facts.indexOf(f);
                    return (
                      <div key={f.id} className="ao-mem-fact">
                        <div className="ao-key">
                          <input
                            value={f.k}
                            placeholder="key"
                            onChange={(e) => updateFact(gi, fi, { k: e.target.value })}
                            className="bg-transparent border-0 outline-none w-full text-[var(--ao-fg-2)] font-[var(--ao-font-mono)] text-[12.5px]"
                          />
                        </div>
                        <div className="ao-val">
                          <input
                            value={f.v}
                            placeholder="value"
                            onChange={(e) => updateFact(gi, fi, { v: e.target.value })}
                          />
                        </div>
                        <div className="ao-actions">
                          <button
                            type="button"
                            aria-label="Delete"
                            className="ao-danger"
                            onClick={() => removeFact(gi, fi)}
                          >
                            <AoTrash size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" className="ao-mem-add-row" onClick={() => addFact(gi)}>
                    <AoPlus size={13} /> add fact to {g.key}
                  </button>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Save bar */}
      {dirty && (
        <div className="ao-save-bar">
          <span className="ao-dirty"><span className="ao-led" /> Unsaved changes</span>
          <span className="ao-hint ao-mono ao-tiny">~/.claude/agents/{agentId}.memory.yaml</span>
          <div className="ao-right">
            <button type="button" className="ao-btn ao-ghost" onClick={handleDiscard}>
              Discard
            </button>
            <button
              type="button"
              className="ao-btn ao-primary"
              onClick={handleSave}
              disabled={writeMem.isPending}
            >
              <AoCheck size={13} /> Save memory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
