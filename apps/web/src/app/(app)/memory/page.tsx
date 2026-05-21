"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAgents } from "@/modules/agents/hooks/use-agents";
import { useProjects } from "@/modules/projects/hooks/use-projects";
import { useMemory, type MemoryScope } from "@/modules/memory/hooks/use-memory";
import { useMemoryDraft } from "@/modules/memory/hooks/use-memory-draft";
import { cn } from "@/lib/cn";
import type { IconName } from "@/components/ui/icon";

// ─── helpers ──────────────────────────────────────────────────────────────────

function scopeKey(scope: MemoryScope): string {
  if (scope.kind === "global") return "global";
  return `${scope.kind}:${scope.id}`;
}

// ─── Scope editor ─────────────────────────────────────────────────────────────

type SaveState = { isDirty: boolean; isSaving: boolean; savedRecently: boolean; saveError: Error | null };

type ScopeEditorProps = {
  scope: MemoryScope;
  saveFnRef: React.MutableRefObject<() => Promise<void>>;
  onSaveState: (s: SaveState) => void;
  onContentLoaded: (key: string, hasContent: boolean) => void;
};

function ScopeEditor({ scope, saveFnRef, onSaveState, onContentLoaded }: ScopeEditorProps) {
  const t = useTranslations("memory_page");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stabilize memory.save so useMemoryDraft doesn't thrash
  const memory = useMemory(scope);
  const memorySaveRef = useRef(memory.save);
  memorySaveRef.current = memory.save;
  const stableSave = useCallback((text: string) => memorySaveRef.current(text), []);

  const draft = useMemoryDraft({ initialValue: memory.content, onSave: stableSave });

  // Keep page-level save function ref fresh
  saveFnRef.current = draft.save;

  // Sync save display state up to the page (for PageHeader)
  const stableOnSaveState = useRef(onSaveState);
  stableOnSaveState.current = onSaveState;
  useEffect(() => {
    stableOnSaveState.current({ isDirty: draft.isDirty, isSaving: draft.isSaving, savedRecently: draft.savedRecently, saveError: memory.saveError });
  }, [draft.isDirty, draft.isSaving, draft.savedRecently, memory.saveError]);

  // Notify parent when content is known (for density dots in nav)
  const stableOnContentLoaded = useRef(onContentLoaded);
  stableOnContentLoaded.current = onContentLoaded;
  useEffect(() => {
    if (!memory.isLoading) {
      stableOnContentLoaded.current(scopeKey(scope), memory.content.trim().length > 0);
    }
  }, [memory.isLoading, memory.content, scope]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (draft.isDirty && !draft.isSaving) void draft.save();
    }
  };

  const charCount = draft.draft.length;
  const tokenEstimate = Math.round(charCount / 4);

  return (
    <div className="flex flex-col h-full min-h-0 p-[20px]">
      <div className="flex-1 min-h-0 flex flex-col bg-bg-0 border-x border-b border-line rounded-[10px] overflow-hidden">
        {/* Editor toolbar */}
        <div className="flex items-center gap-[8px] px-[14px] py-[8px] border-b border-line bg-bg-1 shrink-0">
          <Icon
            name={scope.kind === "global" ? "memory" : scope.kind === "project" ? "folder" : "cpu"}
            size={12}
            className="text-txt-3 shrink-0"
          />
          <span className="font-semibold text-[12.5px] text-txt">
            {scope.kind === "global" ? t("global_label") : scope.kind === "project" ? scope.name : scope.name}
          </span>
          <span className="font-[var(--font-mono)] text-[10px] text-txt-4 bg-bg-2 border border-line px-[6px] py-[1px] rounded-[4px]">markdown</span>
          <span className="ml-auto font-[var(--font-mono)] text-[10.5px] text-txt-4">
            {charCount > 0 ? `${charCount.toLocaleString()} chars · ~${tokenEstimate.toLocaleString()} tokens` : "empty"}
          </span>
        </div>

        {/* Content */}
        {memory.isLoading ? (
          <div className="p-[16px] flex flex-col gap-[6px]">
            <Skeleton width="80%" height={14} />
            <Skeleton width="60%" height={14} />
            <Skeleton width="70%" height={14} />
          </div>
        ) : memory.loadError ? (
          <div className="m-[14px] px-[14px] py-3 border border-[var(--error)] rounded-md text-[13px] bg-[rgba(239,68,68,0.08)] text-[var(--error)]">
            {memory.loadError.message}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={draft.draft}
            onChange={(e) => draft.setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("no_content")}
            aria-label={scope.kind === "global" ? t("global_label") : scope.name}
            className="flex-1 min-h-0 resize-none font-[var(--font-mono)] text-[12.5px] bg-transparent border-0 outline-none text-txt leading-[1.75] p-[16px] placeholder:text-txt-4"
          />
        )}
      </div>
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
      <Icon name={icon} size={12} className="shrink-0" style={{ opacity: selected ? 1 : 0.55 }} />
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
  const [saveState, setSaveState] = useState<SaveState>({
    isDirty: false, isSaving: false, savedRecently: false, saveError: null,
  });
  const [contentMap, setContentMap] = useState<Map<string, boolean>>(new Map());
  const saveFnRef = useRef<() => Promise<void>>(async () => {});

  const handleSaveState = useCallback((s: SaveState) => setSaveState(s), []);

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
      <PageHeader
        title={t("title")}
        sub="· global, project & agent memory"
        actions={
          saveState.isDirty ? (
            <button
              type="button"
              className="inline-flex items-center gap-[6px] bg-acc font-semibold cursor-pointer px-[14px] py-[8px] text-white rounded-[9px] text-[13px] transition-[background] duration-[120ms] hover:bg-[var(--acc-hover)] border-none disabled:opacity-50"
              disabled={saveState.isSaving}
              onClick={() => void saveFnRef.current()}
            >
              {saveState.isSaving ? "Saving…" : "Save"}
            </button>
          ) : saveState.savedRecently ? (
            <span className="font-[var(--font-mono)] text-[12px] text-[var(--done)] flex items-center gap-[5px]">
              <Icon name="check" size={12} /> Saved
            </span>
          ) : null
        }
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <NavTree selected={scope} onSelect={setScope} contentMap={contentMap} />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScopeEditor
            key={scopeKey(scope)}
            scope={scope}
            saveFnRef={saveFnRef}
            onSaveState={handleSaveState}
            onContentLoaded={handleContentLoaded}
          />
        </div>
      </div>
    </>
  );
}
