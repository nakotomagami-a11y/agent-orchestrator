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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        padding: "18px 24px",
        gap: 14,
      }}
    >
      {/* Header */}
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          flexShrink: 0,
        }}
      >
        {title}
      </h2>

      {/* Content area */}
      {memory.isLoading ? (
        <div role="status" aria-label={t("empty_select")} style={{ flex: 1 }}>
          <Skeleton width="100%" height={300} />
        </div>
      ) : memory.loadError ? (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid var(--error)",
            borderRadius: "var(--r-md)",
            fontSize: 13,
            color: "var(--error)",
            flexShrink: 0,
          }}
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
          style={{
            flex: 1,
            resize: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: 12,
            color: "var(--txt)",
            lineHeight: 1.6,
            outline: "none",
            minHeight: 200,
            transition: "border-color 120ms",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--acc)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--line)";
          }}
        />
      )}

      {/* Footer: status + save button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          aria-live="polite"
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            minHeight: 16,
            color: memory.saveError ? "var(--error)" : "var(--done)",
            opacity: memory.saveError ? 1 : draft.savedRecently ? 1 : 0,
            transition: "opacity 200ms",
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: 32,
        paddingLeft: indent ? 20 : 8,
        paddingRight: 8,
        background: selected ? "var(--acc-faint)" : "transparent",
        border: "none",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        font: "inherit",
        fontSize: 13,
        color: selected ? "var(--acc)" : "var(--txt-2)",
        textAlign: "left",
        fontWeight: selected ? 600 : 400,
      }}
    >
      <Icon
        name={icon}
        size={14}
        aria-hidden
        style={{ flexShrink: 0, opacity: selected ? 1 : 0.65 }}
      />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
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
      style={{
        width: 200,
        flexShrink: 0,
        borderRight: "1px solid var(--line)",
        overflow: "auto",
        padding: "14px 6px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
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
      <div className="section-h" style={{ marginTop: 10, padding: "6px 8px 2px" }}>
        {t("projects_heading")}
      </div>

      {projectsQ.isLoading ? (
        <div style={{ padding: "4px 8px" }}>
          <Skeleton width="80%" height={14} />
        </div>
      ) : !projectsQ.data || projectsQ.data.length === 0 ? (
        <div
          style={{
            padding: "4px 8px",
            fontSize: 11.5,
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
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
      <div className="section-h" style={{ marginTop: 10, padding: "6px 8px 2px" }}>
        {t("agents_heading")}
      </div>

      {agentsQ.isLoading ? (
        <div style={{ padding: "4px 8px" }}>
          <Skeleton width="80%" height={14} />
        </div>
      ) : !agentsQ.data || agentsQ.data.length === 0 ? (
        <div
          style={{
            padding: "4px 8px",
            fontSize: 11.5,
            color: "var(--txt-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
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

      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <NavTree selected={scope} onSelect={setScope} />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <ScopeEditor scope={scope} />
        </div>
      </div>
    </>
  );
}
