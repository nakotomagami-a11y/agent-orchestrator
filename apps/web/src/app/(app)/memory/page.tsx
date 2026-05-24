"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { useAgents } from "@/modules/agents/hooks/use-agents";
import { useProjects } from "@/modules/projects/hooks/use-projects";
import { useMemory, type MemoryScope } from "@/modules/memory/hooks/use-memory";
import { MemoryEditor } from "@/modules/memory/components/memory-editor";
import { cn } from "@/lib/cn";
import type { IconName } from "@/components/ui/icon";

// ─── helpers ──────────────────────────────────────────────────────────────────

function scopeKey(scope: MemoryScope): string {
  if (scope.kind === "global") return "global";
  return `${scope.kind}:${scope.id}`;
}

// ─── Scope editor ─────────────────────────────────────────────────────────────

type ScopeEditorProps = {
  scope: MemoryScope;
  onContentLoaded: (key: string, hasContent: boolean) => void;
};

function ScopeEditor({ scope, onContentLoaded }: ScopeEditorProps) {
  const t = useTranslations("memory_page");
  const memory = useMemory(scope);

  useEffect(() => {
    if (!memory.isLoading) {
      onContentLoaded(scopeKey(scope), memory.content.trim().length > 0);
    }
  }, [memory.isLoading, memory.content, scope, onContentLoaded]);

  if (memory.isLoading) {
    return (
      <div className="flex flex-col gap-[6px] p-[20px]">
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={14} />
        <Skeleton width="70%" height={14} />
      </div>
    );
  }

  if (memory.loadError) {
    return (
      <div className="px-[14px] py-3 m-[20px] border border-[var(--error)] rounded-md text-[13px] bg-[rgba(239,68,68,0.08)] text-[var(--error)]">
        {memory.loadError.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-[20px]">
      <MemoryEditor
        value={memory.content}
        onSave={memory.save}
        placeholder={t("no_content")}
      />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

type NavItemProps = {
  scope: MemoryScope;
  label: string;
  icon: IconName;
  selected: boolean;
  hasContent: boolean;
  onSelect: (s: MemoryScope) => void;
  depth?: number;
};

function NavItem({ scope, label, icon, selected, hasContent, onSelect, depth = 0 }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(scope)}
      className={cn(
        "flex items-center gap-[6px] w-full h-[22px] text-[12px] border-none cursor-pointer text-left font-[inherit] select-none transition-colors duration-[80ms]",
        selected ? "text-acc font-medium" : "bg-transparent text-txt-2 hover:bg-bg-3 hover:text-txt",
      )}
      style={{
        paddingLeft: depth === 0 ? 8 : 20,
        paddingRight: 8,
        background: selected ? "rgba(var(--acc-rgb, 200 80 40), 0.07)" : undefined,
        boxShadow: selected ? "inset 2px 0 0 var(--acc)" : "inset 2px 0 0 transparent",
      }}
    >
      <Icon name={icon} size={12} className={cn("shrink-0", selected ? "opacity-100" : "opacity-[0.55]")} />
      <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">{label}</span>
      {hasContent && (
        <span
          className="shrink-0 w-[5px] h-[5px] rounded-full"
          style={{ background: selected ? "var(--acc)" : "rgba(255,255,255,0.25)" }}
        />
      )}
    </button>
  );
}

function NavSection({ label }: { label: string }) {
  return (
    <div className="flex items-center h-[20px] mt-[10px] mb-[1px] px-[8px] text-[9.5px] font-semibold tracking-[0.1em] uppercase text-txt-4 select-none">
      {label}
    </div>
  );
}

type NavTreeProps = {
  selected: MemoryScope;
  onSelect: (s: MemoryScope) => void;
  contentMap: Map<string, boolean>;
};

function NavTree({ selected, onSelect, contentMap }: NavTreeProps) {
  const t = useTranslations("memory_page");
  const agentsQ = useAgents();
  const projectsQ = useProjects();

  function isSel(scope: MemoryScope): boolean {
    if (scope.kind !== selected.kind) return false;
    if (scope.kind === "global") return true;
    if (scope.kind === "project" && selected.kind === "project") return scope.id === selected.id;
    if (scope.kind === "agent" && selected.kind === "agent") return scope.id === selected.id;
    return false;
  }

  return (
    <nav
      aria-label="Memory scopes"
      className="w-[204px] shrink-0 border-r border-line overflow-y-auto flex flex-col"
    >
      <div className="flex-1 py-[6px] px-[4px] flex flex-col gap-[1px]">
        <NavItem
          scope={{ kind: "global" }}
          label={t("global_label")}
          icon="memory"
          selected={isSel({ kind: "global" })}
          hasContent={contentMap.get("global") ?? false}
          onSelect={onSelect}
        />

        <NavSection label={t("projects_heading")} />
        {projectsQ.isLoading ? (
          <div className="px-[8px] py-[3px]"><Skeleton width="70%" height={12} /></div>
        ) : !projectsQ.data?.length ? (
          <div className="px-[20px] py-[2px] text-[11px] text-txt-4 font-[var(--font-mono)]">{t("no_projects")}</div>
        ) : (
          projectsQ.data.map((p) => {
            const scope: MemoryScope = { kind: "project", id: p.id, name: p.name };
            return (
              <NavItem
                key={p.id}
                scope={scope}
                label={p.name}
                icon="folder"
                selected={isSel(scope)}
                hasContent={contentMap.get(scopeKey(scope)) ?? false}
                onSelect={onSelect}
                depth={1}
              />
            );
          })
        )}

        <NavSection label={t("agents_heading")} />
        {agentsQ.isLoading ? (
          <div className="px-[8px] py-[3px]"><Skeleton width="70%" height={12} /></div>
        ) : !agentsQ.data?.length ? (
          <div className="px-[20px] py-[2px] text-[11px] text-txt-4 font-[var(--font-mono)]">{t("no_agents")}</div>
        ) : (
          agentsQ.data.map((a) => {
            const scope: MemoryScope = { kind: "agent", id: a.name, name: a.name };
            return (
              <NavItem
                key={a.name}
                scope={scope}
                label={a.name}
                icon="cpu"
                selected={isSel(scope)}
                hasContent={contentMap.get(scopeKey(scope)) ?? false}
                onSelect={onSelect}
                depth={1}
              />
            );
          })
        )}
      </div>

      {/* Keyboard hint */}
      <div className="px-[10px] py-[8px] border-t border-line shrink-0">
        <span className="font-[var(--font-mono)] text-[10px] text-txt-4">⌘S to save</span>
      </div>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const t = useTranslations("memory_page");
  const [scope, setScope] = useState<MemoryScope>({ kind: "global" });
  const [contentMap, setContentMap] = useState<Map<string, boolean>>(new Map());

  const handleContentLoaded = useCallback((key: string, hasContent: boolean) => {
    setContentMap((prev) => {
      if (prev.get(key) === hasContent) return prev;
      const next = new Map(prev);
      next.set(key, hasContent);
      return next;
    });
  }, []);

  return (
    <>
      <PageHeader title={t("title")} sub="· global, project & agent memory" />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <NavTree selected={scope} onSelect={setScope} contentMap={contentMap} />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScopeEditor
            key={scopeKey(scope)}
            scope={scope}
            onContentLoaded={handleContentLoaded}
          />
        </div>
      </div>
    </>
  );
}
