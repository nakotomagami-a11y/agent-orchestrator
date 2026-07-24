"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/domain/hooks/api";
import { queryKeys } from "@agent-office/domain/hooks/query-keys";
import { API_ROUTES } from "@agent-office/domain/config/routes";
import type { AppSettings, ScannedEntry, Project, HealthInfo } from "@agent-office/domain/types";
import { Button } from "@/components/ui/button";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { cn } from "@/lib/cn";
import { RequirementsStep } from "./first-run-wizard-steps/requirements-step";
import { RootStep } from "./first-run-wizard-steps/root-step";
import { ExcludedStep } from "./first-run-wizard-steps/excluded-step";
import { AgentsStep } from "./first-run-wizard-steps/agents-step";
import { ProjectStep } from "./first-run-wizard-steps/project-step";

/**
 * First-run wizard. A four-step modal that appears once on a fresh
 * install and walks the user through:
 *
 *   1. Projects root path - where their code folders live on disk.
 *   2. Excluded folders   - names to skip when scanning (with a
 *      sensible default list pre-filled).
 *   3. Starter agents     - checkboxes for which of the 13 bundled
 *      agents to import into ~/.claude/agents/. "Select all" is the
 *      first checkbox so users who want the demo can click once.
 *   4. First project      - pick one of the scanned folders to turn
 *      into the user's first project, optionally name it.
 *
 * On finish: PUT /api/settings (marks firstRunComplete: true), POST
 * /api/starter/agents (imports the selected agents), POST
 * /api/projects (creates the first project). The user lands on a
 * populated UI with the project active in the sidebar.
 *
 * Steps can be skipped: empty agents list is allowed, project step is
 * skippable. Settings step (root path) is mandatory - it's what
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

type Step = "requirements" | "root" | "excluded" | "agents" | "project";
const STEP_ORDER: Step[] = ["requirements", "root", "excluded", "agents", "project"];

export function FirstRunWizard({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const setActiveProjectId = useActiveProjectStore((s) => s.setId);

  const [step, setStep] = useState<Step>("requirements");
  const [root, setRoot] = useState(HOME_FALLBACK);
  const [excluded, setExcluded] = useState<string[]>(DEFAULT_EXCLUDED);
  const [excludedInput, setExcludedInput] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [chosenFolder, setChosenFolder] = useState<ScannedEntry | null>(null);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Belt-and-braces dismissal flag. The gate normally unmounts the
  // wizard once `/api/settings` refetches and reports
  // `firstRunComplete: true`, but if the invalidate/refetch is slow or
  // dropped (e.g. transient network blip in the embedded webview) the
  // user would be stranded staring at "Setting things up…". This
  // local flag lets us close ourselves the instant the mutation
  // succeeds, independently of whether the gate's query has caught up.
  const [dismissed, setDismissed] = useState(false);

  const healthQ = useQuery({
    queryKey: ["wizard-health"],
    queryFn: () => apiFetch<HealthInfo>(API_ROUTES.health),
    refetchInterval: (q) => (q.state.data?.available ? false : 5000),
  });

  const starterQ = useQuery({
    queryKey: ["starter-agents"],
    queryFn: () => apiFetch<StarterAgent[]>("/api/starter/agents"),
  });
  const starter = useMemo(() => starterQ.data ?? [], [starterQ.data]);

  // Pre-select every starter agent the first time the list loads -
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
      // 1. Persist settings - this flips firstRunComplete: true.
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
      // Important: close ourselves first via the local dismiss flag,
      // BEFORE waiting on any refetches. The gate's invalidate-based
      // unmount still runs, but we don't depend on it any more - if
      // it succeeds the gate also returns null, and our null
      // short-circuit makes the wizard disappear immediately.
      if (createdId) setActiveProjectId(createdId);
      setBusy(false);
      setDismissed(true);
      qc.invalidateQueries({ queryKey: queryKeys.settings.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.agents.all });
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
    if (step === "requirements" && !healthQ.data?.available) {
      setError(t("first_run.req_block"));
      return;
    }
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

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] p-[24px] [backdrop-filter:blur(8px)] bg-[rgba(0,0,0,0.72)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fr-title"
    >
      <div
        className="flex flex-col overflow-hidden border border-line-2 rounded-[8px] w-[min(720px,100%)] max-h-[90vh] bg-[var(--bg-elev)] shadow-[0_24px_60px_rgba(0,0,0,0.45),_0_4px_12px_rgba(0,0,0,0.25)]"
      >
        <header className="border-b border-line-2 px-[24px] pt-[20px] pb-[12px]">
          <h2 id="fr-title" className="font-semibold m-0 mb-[4px] text-[18px]">{t("first_run.title")}</h2>
          <p className="text-txt-3 m-0 text-[13px]">{t("first_run.subtitle")}</p>
          <ol className="flex list-none uppercase text-txt-3 pt-[14px] m-0 gap-[6px] font-[var(--font-mono)] text-[11px] tracking-[0.06em]">
            {STEP_ORDER.map((s, i) => (
              <li
                key={s}
                className={cn(
                  "inline-flex items-center border border-line rounded-full gap-[6px] px-[10px] py-[4px]",
                  i === stepIdx && "text-acc [border-color:var(--acc)]",
                  i < stepIdx && "text-txt-2",
                )}
              >
                <span className={cn(
                  "inline-flex items-center justify-center rounded-full w-[18px] h-[18px] text-[10px]",
                  i === stepIdx ? "bg-acc text-white" : i < stepIdx ? "bg-acc-faint text-acc" : "bg-bg-2 text-txt-3",
                )}>
                  {i + 1}
                </span>
                {t(`first_run.step_${s}`)}
              </li>
            ))}
          </ol>
        </header>

        <div className="overflow-y-auto flex-1 px-[24px] py-[18px]">
          {step === "requirements" ? (
            <RequirementsStep health={healthQ.data} loading={healthQ.isLoading} />
          ) : null}

          {step === "root" ? (
            <RootStep root={root} onRootChange={setRoot} placeholder={HOME_FALLBACK} />
          ) : null}

          {step === "excluded" ? (
            <ExcludedStep
              excluded={excluded}
              input={excludedInput}
              onInputChange={setExcludedInput}
              onAdd={addExcluded}
              onRemove={removeExcluded}
            />
          ) : null}

          {step === "agents" ? (
            <AgentsStep
              starter={starter}
              loading={starterQ.isLoading}
              selected={selectedAgents}
              onToggle={toggleAgent}
              onToggleAll={toggleAll}
            />
          ) : null}

          {step === "project" ? (
            <ProjectStep
              candidates={candidates}
              loading={scanQ.isLoading}
              root={root}
              chosen={chosenFolder}
              onChoose={(c) => { setChosenFolder(c); setProjectName(c.name); }}
              projectName={projectName}
              onProjectNameChange={setProjectName}
            />
          ) : null}
        </div>

        {error ? (
          <div
            className="mx-[24px] px-[12px] py-[8px] rounded-[6px] text-[12px] bg-[rgba(239,68,68,0.1)] border border-[var(--error)] text-[var(--error)]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <footer className="border-t border-line-2 flex items-center px-[24px] py-[14px] gap-[8px]">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={isFirst || busy}
          >
            {t("common.back")}
          </Button>
          <div className="flex-1" />
          {!isLast ? (
            <Button variant="primary" onClick={goNext} disabled={busy}>
              {t("common.next")}
            </Button>
          ) : (
            <Button variant="primary" onClick={onFinish} disabled={busy}>
              {busy ? t("first_run.finishing") : t("first_run.finish")}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

