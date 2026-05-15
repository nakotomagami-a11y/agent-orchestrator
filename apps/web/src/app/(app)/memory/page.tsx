"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents } from "@/modules/agents/hooks/use-agents";
import { useProjects } from "@/modules/projects/hooks/use-projects";
import { useMemory, type MemoryScope } from "@/modules/memory/hooks/use-memory";
import { useMemoryDraft } from "@/modules/memory/hooks/use-memory-draft";
import type { IconName } from "@/components/ui/icon";

// ─── Scope editor ─────────────────────────────────────────────────────────────

/**
 * Renders the textarea + save button for the currently selected scope.
 * Composes useMemory (remote fetch/put) with useMemoryDraft (local draft state).
 */
function ScopeEditor({ scope }: { scope: MemoryScope }) {
  const t = useTranslations("memory_page");
  const memory = useMemory(scope);
  const draft = useMemoryDraft({ initialValue: memory.content, onSave: memory.save });

  const title =
    scope.kind === "global"
      ? t("global_label")
      : scope.kind === "project"
        ? `Project: ${scope.name}`
        : `Agent: ${scope.name}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (draft.isDirty && !draft.isSaving) {
        void draft.save();
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 px-6 py-[18px] gap-3.5">
      {/* Header */}
      <h2 className="m-0 text-base font-bold tracking-[-0.01em] shrink-0">
        {title}
      </h2>

      {/* Content area */}
      {memory.isLoading ? (
        <div role="status" aria-label={t("empty_select")} className="flex-1">
          <Skeleton width="100%" height={300} />
        </div>
      ) : memory.loadError ? (
        <div
          role="alert"
          className="px-[14px] py-3 border border-[var(--error)] rounded-md text-[13px] shrink-0 bg-[rgba(239,68,68,0.08)] text-[var(--error)]"
        >
          {memory.loadError.message}
        </div>
      ) : (
        <textarea
          value={draft.draft}
          onChange={(e) => draft.setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("no_content")}
          aria-label={title}
          className="flex-1 resize-none font-mono text-[13px] bg-bg-1 border border-line rounded-md p-3 text-txt outline-none leading-[1.6] min-h-[200px] transition-[border-color] duration-[120ms]"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--acc)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--line)";
          }}
        />
      )}

      {/* Footer: status + save button */}
      <div className="flex items-center justify-end gap-2.5 shrink-0">
        <span
          aria-live="polite"
          className="text-xs font-mono min-h-[16px] transition-[opacity] duration-[200ms]"
          style={{
            color: memory.saveError ? "var(--error)" : "var(--done)",
            opacity: memory.saveError ? 1 : draft.savedRecently ? 1 : 0,
          }}
        >
          {memory.saveError ? t("save_error") : t("saved")}
        </span>
        <button
          type="button"
          className="btn primary"
          disabled={!draft.isDirty || draft.isSaving || memory.isLoading}
          onClick={() => void draft.save()}
        >
          {draft.isSaving ? t("saving") : t("save_button")}
        </button>
      </div>
    </div>
  );
}

// ─── Nav tree ─────────────────────────────────────────────────────────────────

type NavScopeBtnProps = {
  scope: MemoryScope;
  label: string;
  icon: IconName;
  selected: boolean;
  onSelect: (scope: MemoryScope) => void;
  indent?: boolean;
};

function NavScopeButton({
  scope,
  label,
  icon,
  selected,
  onSelect,
  indent = false,
}: NavScopeBtnProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(scope)}
      aria-current={selected ? ("true" as const) : undefined}
      className="flex items-center gap-2 w-full h-8 pr-2 border-none rounded-sm cursor-pointer text-[13px] text-left font-[inherit]"
      style={{
        paddingLeft: indent ? 20 : 8,
        background: selected ? "var(--acc-faint)" : "transparent",
        color: selected ? "var(--acc)" : "var(--txt-2)",
        fontWeight: selected ? 600 : 400,
      }}
    >
      <Icon
        name={icon}
        size={14}
        aria-hidden
        className="shrink-0"
        style={{ opacity: selected ? 1 : 0.65 }}
      />
      <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
        {label}
      </span>
    </button>
  );
}

type NavTreeProps = {
  selected: MemoryScope;
  onSelect: (scope: MemoryScope) => void;
};

function NavTree({ selected, onSelect }: NavTreeProps) {
  const t = useTranslations("memory_page");
  const agentsQ = useAgents();
  const projectsQ = useProjects();

  function isScopeSelected(scope: MemoryScope): boolean {
    if (scope.kind !== selected.kind) return false;
    if (scope.kind === "global") return true;
    if (scope.kind === "project" && selected.kind === "project")
      return scope.id === selected.id;
    if (scope.kind === "agent" && selected.kind === "agent")
      return scope.id === selected.id;
    return false;
  }

  return (
    <nav
      aria-label="Memory scopes"
      className="w-[200px] shrink-0 border-r border-line overflow-auto py-[14px] px-[6px] flex flex-col gap-0.5"
    >
      {/* Global */}
      <NavScopeButton
        scope={{ kind: "global" }}
        label={t("global_label")}
        icon="memory"
        selected={isScopeSelected({ kind: "global" })}
        onSelect={onSelect}
      />

      {/* Projects */}
      <div className="section-h mt-[10px] !px-2 !pt-[6px] !pb-0.5">
        {t("projects_heading")}
      </div>

      {projectsQ.isLoading ? (
        <div className="px-2 py-1">
          <Skeleton width="80%" height={14} />
        </div>
      ) : !projectsQ.data || projectsQ.data.length === 0 ? (
        <div className="px-2 py-1 text-[11.5px] text-txt-3 font-mono">
          {t("no_projects")}
        </div>
      ) : (
        projectsQ.data.map((p) => {
          const scope: MemoryScope = { kind: "project", id: p.id, name: p.name };
          return (
            <NavScopeButton
              key={p.id}
              scope={scope}
              label={p.name}
              icon="folder"
              selected={isScopeSelected(scope)}
              onSelect={onSelect}
              indent
            />
          );
        })
      )}

      {/* Agents */}
      <div className="section-h mt-[10px] !px-2 !pt-[6px] !pb-0.5">
        {t("agents_heading")}
      </div>

      {agentsQ.isLoading ? (
        <div className="px-2 py-1">
          <Skeleton width="80%" height={14} />
        </div>
      ) : !agentsQ.data || agentsQ.data.length === 0 ? (
        <div className="px-2 py-1 text-[11.5px] text-txt-3 font-mono">
          {t("no_agents")}
        </div>
      ) : (
        agentsQ.data.map((a) => {
          // ApiAgent.name is the file slug (id) as well as the display name.
          // The agents service sets name = frontmatter.name ?? filename_slug,
          // and the memory API uses the same slug as the path segment.
          const scope: MemoryScope = { kind: "agent", id: a.name, name: a.name };
          return (
            <NavScopeButton
              key={a.name}
              scope={scope}
              label={a.name}
              icon="cpu"
              selected={isScopeSelected(scope)}
              onSelect={onSelect}
              indent
            />
          );
        })
      )}
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const t = useTranslations("memory_page");
  const [scope, setScope] = useState<MemoryScope>({ kind: "global" });

  return (
    <>
      <div className="toolbar">
        <h1>{t("title")}</h1>
        <span className="sub">· global, project &amp; agent memory</span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <NavTree selected={scope} onSelect={setScope} />

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScopeEditor scope={scope} />
        </div>
      </div>
    </>
  );
}
