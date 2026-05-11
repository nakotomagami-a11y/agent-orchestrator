"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import type { AppSettings, ScannedEntry, Project } from "@agent-office/shared/types";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/text-input";
import { useActiveProjectStore } from "@/lib/active-project-store";

/**
 * First-run wizard. A four-step modal that appears once on a fresh
 * install and walks the user through:
 *
 *   1. Projects root path — where their code folders live on disk.
 *   2. Excluded folders   — names to skip when scanning (with a
 *      sensible default list pre-filled).
 *   3. Starter agents     — checkboxes for which of the 13 bundled
 *      agents to import into ~/.claude/agents/. "Select all" is the
 *      first checkbox so users who want the demo can click once.
 *   4. First project      — pick one of the scanned folders to turn
 *      into the user's first project, optionally name it.
 *
 * On finish: PUT /api/settings (marks firstRunComplete: true), POST
 * /api/starter/agents (imports the selected agents), POST
 * /api/projects (creates the first project). The user lands on a
 * populated UI with the project active in the sidebar.
 *
 * Steps can be skipped: empty agents list is allowed, project step is
 * skippable. Settings step (root path) is mandatory — it's what
 * "first-run complete" means.
 */

const DEFAULT_EXCLUDED = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "_legacy",
  "PIXEL",
  ".pnpm-store",
];

const HOME_FALLBACK = "~/Documents";

interface StarterAgent {
  id: string;
  name: string;
  description: string;
}

type Step = "root" | "excluded" | "agents" | "project";
const STEP_ORDER: Step[] = ["root", "excluded", "agents", "project"];

export function FirstRunWizard({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const setActiveProjectId = useActiveProjectStore((s) => s.setId);

  const [step, setStep] = useState<Step>("root");
  const [root, setRoot] = useState(HOME_FALLBACK);
  const [excluded, setExcluded] = useState<string[]>(DEFAULT_EXCLUDED);
  const [excludedInput, setExcludedInput] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [chosenFolder, setChosenFolder] = useState<ScannedEntry | null>(null);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const starterQ = useQuery({
    queryKey: ["starter-agents"],
    queryFn: () => apiFetch<StarterAgent[]>("/api/starter/agents"),
  });
  const starter = starterQ.data ?? [];

  // Pre-select every starter agent the first time the list loads —
  // most users will want the full demo set, and unticking is faster
  // than ticking 13 boxes.
  useEffect(() => {
    if (starter.length > 0 && selectedAgents.size === 0) {
      setSelectedAgents(new Set(starter.map((a) => a.id)));
    }
  }, [starter, selectedAgents.size]);

  const scanParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("root", root);
    if (excluded.length > 0) p.set("excluded", excluded.join(","));
    p.set("includeExcluded", "0");
    return p.toString();
  }, [root, excluded]);

  const scanQ = useQuery({
    queryKey: ["wizard-scan", root, excluded.join(",")],
    queryFn: () => apiFetch<ScannedEntry[]>(`${API_ROUTES.settingsScan}?${scanParams}`),
    enabled: step === "project" && root.length > 0,
  });
  const candidates = scanQ.data ?? [];

  const finishMut = useMutation({
    mutationFn: async () => {
      // 1. Persist settings — this flips firstRunComplete: true.
      await apiFetch<AppSettings>(API_ROUTES.settings, {
        method: "PUT",
        body: { projectsRoot: root.trim(), excluded },
      });

      // 2. Import selected agents (no-op if the user unticked all).
      if (selectedAgents.size > 0) {
        await apiFetch<{ imported: number }>("/api/starter/agents", {
          method: "POST",
          body: { agentIds: [...selectedAgents] },
        });
      }

      // 3. Create the first project, if the user picked a folder.
      let createdId: string | null = null;
      if (chosenFolder) {
        const name = projectName.trim() || chosenFolder.name;
        const project = await apiFetch<Project>(API_ROUTES.projects, {
          method: "POST",
          body: { id: chosenFolder.id, name },
        });
        createdId = project.id;
      }
      return { createdId };
    },
    onSuccess: ({ createdId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.agents.all });
      if (createdId) setActiveProjectId(createdId);
      onDone();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    },
  });

  const onFinish = () => {
    if (!root.trim()) {
      setError(t("first_run.error_root_required"));
      setStep("root");
      return;
    }
    setError(null);
    setBusy(true);
    finishMut.mutate();
  };

  const stepIdx = STEP_ORDER.indexOf(step);
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEP_ORDER.length - 1;

  const goNext = () => {
    if (step === "root" && !root.trim()) {
      setError(t("first_run.error_root_required"));
      return;
    }
    setError(null);
    setStep(STEP_ORDER[stepIdx + 1] ?? "project");
  };
  const goBack = () => {
    setError(null);
    setStep(STEP_ORDER[Math.max(0, stepIdx - 1)] ?? "root");
  };

  const addExcluded = () => {
    const v = excludedInput.trim();
    if (!v) return;
    if (excluded.includes(v)) {
      setExcludedInput("");
      return;
    }
    setExcluded((prev) => [...prev, v]);
    setExcludedInput("");
  };
  const removeExcluded = (name: string) => {
    setExcluded((prev) => prev.filter((x) => x !== name));
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedAgents.size === starter.length) setSelectedAgents(new Set());
    else setSelectedAgents(new Set(starter.map((a) => a.id)));
  };

  return (
    <div className="first-run-overlay" role="dialog" aria-modal="true" aria-labelledby="fr-title">
      <div className="first-run-card">
        <header className="first-run-header">
          <h2 id="fr-title">{t("first_run.title")}</h2>
          <p className="first-run-sub">{t("first_run.subtitle")}</p>
          <ol className="first-run-steps">
            {STEP_ORDER.map((s, i) => (
              <li key={s} className={i === stepIdx ? "active" : i < stepIdx ? "done" : ""}>
                <span>{i + 1}</span>
                {t(`first_run.step_${s}`)}
              </li>
            ))}
          </ol>
        </header>

        <div className="first-run-body">
          {step === "root" ? (
            <section>
              <h3>{t("first_run.root_title")}</h3>
              <p className="first-run-hint">{t("first_run.root_hint")}</p>
              <TextInput
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                placeholder={HOME_FALLBACK}
                autoFocus
              />
              <p className="first-run-hint small">{t("first_run.root_examples")}</p>
            </section>
          ) : null}

          {step === "excluded" ? (
            <section>
              <h3>{t("first_run.excluded_title")}</h3>
              <p className="first-run-hint">{t("first_run.excluded_hint")}</p>
              <div className="first-run-chips">
                {excluded.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="chip"
                    onClick={() => removeExcluded(name)}
                    title={t("first_run.excluded_remove", { name })}
                  >
                    {name} <Icon name="x" size={11} />
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput
                  value={excludedInput}
                  onChange={(e) => setExcludedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExcluded();
                    }
                  }}
                  placeholder={t("first_run.excluded_placeholder")}
                />
                <button type="button" className="btn ghost sm" onClick={addExcluded}>
                  {t("first_run.excluded_add")}
                </button>
              </div>
            </section>
          ) : null}

          {step === "agents" ? (
            <section>
              <h3>{t("first_run.agents_title")}</h3>
              <p className="first-run-hint">{t("first_run.agents_hint")}</p>
              {starterQ.isLoading ? (
                <p>{t("common.loading")}</p>
              ) : (
                <>
                  <label className="agent-row select-all">
                    <input
                      type="checkbox"
                      checked={selectedAgents.size === starter.length && starter.length > 0}
                      onChange={toggleAll}
                    />
                    <span className="agent-name">
                      {t("first_run.agents_select_all", { count: starter.length })}
                    </span>
                  </label>
                  <div className="agent-list">
                    {starter.map((a) => (
                      <label key={a.id} className="agent-row">
                        <input
                          type="checkbox"
                          checked={selectedAgents.has(a.id)}
                          onChange={() => toggleAgent(a.id)}
                        />
                        <div>
                          <div className="agent-name">{a.name}</div>
                          <div className="agent-desc">{a.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : null}

          {step === "project" ? (
            <section>
              <h3>{t("first_run.project_title")}</h3>
              <p className="first-run-hint">{t("first_run.project_hint")}</p>
              {scanQ.isLoading ? (
                <p>{t("common.loading")}</p>
              ) : candidates.length === 0 ? (
                <p className="first-run-empty">
                  {t("first_run.project_empty", { root })}
                </p>
              ) : (
                <div className="project-list">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={chosenFolder?.id === c.id ? "project-row selected" : "project-row"}
                      onClick={() => {
                        setChosenFolder(c);
                        setProjectName(c.name);
                      }}
                    >
                      <Icon name="folder" />
                      <div>
                        <div className="agent-name">{c.name}</div>
                        <div className="agent-desc">{c.fullPath}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {chosenFolder ? (
                <div style={{ marginTop: 10 }}>
                  <label className="first-run-hint" htmlFor="fr-project-name">
                    {t("first_run.project_name_label")}
                  </label>
                  <TextInput
                    id="fr-project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
              ) : null}
              <p className="first-run-hint small" style={{ marginTop: 8 }}>
                {t("first_run.project_skip_hint")}
              </p>
            </section>
          ) : null}
        </div>

        {error ? (
          <div className="first-run-error" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="first-run-footer">
          <button
            type="button"
            className="btn ghost"
            onClick={goBack}
            disabled={isFirst || busy}
          >
            {t("common.back")}
          </button>
          <div style={{ flex: 1 }} />
          {!isLast ? (
            <button type="button" className="btn primary" onClick={goNext} disabled={busy}>
              {t("common.next")}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={onFinish} disabled={busy}>
              {busy ? t("first_run.finishing") : t("first_run.finish")}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
