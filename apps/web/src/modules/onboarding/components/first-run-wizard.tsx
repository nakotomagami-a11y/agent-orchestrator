"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@agent-office/shared/hooks/api";
import { queryKeys } from "@agent-office/shared/hooks/query-keys";
import { API_ROUTES } from "@agent-office/shared/config/routes";
import type { AppSettings, ScannedEntry, Project, HealthInfo } from "@agent-office/shared/types";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { useActiveProjectStore } from "@/lib/active-project-store";
import { cn } from "@/lib/cn";

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
      // Important: close ourselves first via the local dismiss flag,
      // BEFORE waiting on any refetches. The gate's invalidate-based
      // unmount still runs, but we don't depend on it any more — if
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
      className="fixed inset-0 flex items-center justify-center z-[9999] p-[24px] [backdrop-filter:blur(8px)]"
      style={{ background: "rgba(0,0,0,0.72)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fr-title"
    >
      <div
        className="flex flex-col overflow-hidden border border-line-2 rounded-[12px] w-[min(720px,100%)] max-h-[90vh]"
        style={{ background: "var(--bg-elev)", boxShadow: "0 24px 60px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.25)" }}
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
            <section>
              <h3 className="font-semibold m-0 mb-[6px] text-[15px]">{t("first_run.requirements_title")}</h3>
              <p className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]">{t("first_run.requirements_hint")}</p>
              <div className="flex flex-col gap-2.5 mt-4">
                <ReqRow
                  label={t("first_run.req_claude_label")}
                  status={
                    healthQ.isLoading
                      ? "checking"
                      : healthQ.data?.available
                        ? "ok"
                        : "error"
                  }
                  okText={t("first_run.req_claude_ok", { version: healthQ.data?.version ?? "" })}
                  checkingText={t("first_run.req_claude_checking")}
                  errorText={t("first_run.req_claude_missing")}
                />
                {!healthQ.isLoading && !healthQ.data?.available ? (
                  <div className="text-txt-3 m-0 mb-[12px] text-[11.5px] leading-[1.5] mt-[6px] mb-0 pl-7">
                    <div>{t("first_run.req_claude_install")}</div>
                    <div className="mt-1">{t("first_run.req_claude_auth_note")}</div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {step === "root" ? (
            <section>
              <h3 className="font-semibold m-0 mb-[6px] text-[15px]">{t("first_run.root_title")}</h3>
              <p className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]">{t("first_run.root_hint")}</p>
              <TextInput
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                placeholder={HOME_FALLBACK}
                autoFocus
              />
              <p className="text-txt-3 m-0 text-[11.5px] leading-[1.5] mt-[6px]">{t("first_run.root_examples")}</p>
            </section>
          ) : null}

          {step === "excluded" ? (
            <section>
              <h3 className="font-semibold m-0 mb-[6px] text-[15px]">{t("first_run.excluded_title")}</h3>
              <p className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]">{t("first_run.excluded_hint")}</p>
              <div className="flex flex-wrap gap-[6px] mb-[10px]">
                {excluded.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="inline-flex items-center bg-bg-2 border border-line rounded-full cursor-pointer text-txt-2 gap-[4px] px-[9px] py-[3px] font-[var(--font-mono)] text-[11.5px] hover:bg-bg-1 hover:text-txt"
                    onClick={() => removeExcluded(name)}
                    title={t("first_run.excluded_remove", { name })}
                  >
                    {name} <Icon name="x" size={11} />
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
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
                <Button variant="ghost" size="sm" onClick={addExcluded}>
                  {t("first_run.excluded_add")}
                </Button>
              </div>
            </section>
          ) : null}

          {step === "agents" ? (
            <section>
              <h3 className="font-semibold m-0 mb-[6px] text-[15px]">{t("first_run.agents_title")}</h3>
              <p className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]">{t("first_run.agents_hint")}</p>
              {starterQ.isLoading ? (
                <p>{t("common.loading")}</p>
              ) : (
                <>
                  <label className="flex items-start cursor-pointer gap-[10px] px-[10px] py-[8px] rounded-[6px] transition-[background] duration-[80ms] bg-acc-faint mb-[6px]" style={{ border: "1px dashed var(--acc)" }}>
                    <input
                      type="checkbox"
                      className="mt-[3px]"
                      checked={selectedAgents.size === starter.length && starter.length > 0}
                      onChange={toggleAll}
                    />
                    <span className="font-medium text-[13px]">
                      {t("first_run.agents_select_all", { count: starter.length })}
                    </span>
                  </label>
                  <div className="flex flex-col overflow-y-auto border border-line-2 gap-[4px] max-h-[320px] rounded-[8px] p-[4px]">
                    {starter.map((a) => (
                      <label key={a.id} className="flex items-start cursor-pointer gap-[10px] px-[10px] py-[8px] rounded-[6px] transition-[background] duration-[80ms] hover:bg-bg-2">
                        <input
                          type="checkbox"
                          className="mt-[3px]"
                          checked={selectedAgents.has(a.id)}
                          onChange={() => toggleAgent(a.id)}
                        />
                        <div>
                          <div className="font-medium text-[13px]">{a.name}</div>
                          <div className="text-txt-3 text-[11.5px] mt-[2px] leading-[1.4]">{a.description}</div>
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
              <h3 className="font-semibold m-0 mb-[6px] text-[15px]">{t("first_run.project_title")}</h3>
              <p className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]">{t("first_run.project_hint")}</p>
              {scanQ.isLoading ? (
                <p>{t("common.loading")}</p>
              ) : candidates.length === 0 ? (
                <p className="bg-bg-2 text-txt-3 px-[16px] py-[16px] rounded-[8px] text-[12.5px]">
                  {t("first_run.project_empty", { root })}
                </p>
              ) : (
                <div className="flex flex-col overflow-y-auto gap-[4px] max-h-[280px]">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        "flex items-center bg-bg-1 border border-line-2 text-left cursor-pointer text-txt gap-[10px] px-[10px] py-[8px] rounded-[8px] font-[inherit] text-[13px] hover:bg-bg-2",
                        chosenFolder?.id === c.id && "bg-acc-faint [border-color:var(--acc)]",
                      )}
                      onClick={() => {
                        setChosenFolder(c);
                        setProjectName(c.name);
                      }}
                    >
                      <Icon name="folder" />
                      <div>
                        <div className="font-medium text-[13px]">{c.name}</div>
                        <div className="text-txt-3 text-[11.5px] mt-[2px] leading-[1.4]">{c.fullPath}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {chosenFolder ? (
                <div className="mt-2.5">
                  <label className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]" htmlFor="fr-project-name">
                    {t("first_run.project_name_label")}
                  </label>
                  <TextInput
                    id="fr-project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
              ) : null}
              <p className="text-txt-3 m-0 text-[11.5px] leading-[1.5] mt-[6px] mt-2">
                {t("first_run.project_skip_hint")}
              </p>
            </section>
          ) : null}
        </div>

        {error ? (
          <div
            className="mx-[24px] px-[12px] py-[8px] rounded-[6px] text-[12px]"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid var(--error)", color: "var(--error)" }}
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

function ReqRow({
  label,
  status,
  okText,
  checkingText,
  errorText,
}: {
  label: string;
  status: "checking" | "ok" | "error";
  okText: string;
  checkingText: string;
  errorText: string;
}) {
  const badge =
    status === "ok" ? "✓" : status === "error" ? "✗" : "…";
  const badgeColor =
    status === "ok"
      ? "var(--success, #22c55e)"
      : status === "error"
        ? "var(--error)"
        : "var(--txt-3)";
  const detail = status === "ok" ? okText : status === "error" ? errorText : checkingText;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span
        aria-hidden
        className="font-bold text-[15px] w-4 text-center shrink-0"
        style={{ color: badgeColor }}
      >
        {badge}
      </span>
      <span className="font-semibold min-w-[90px]">{label}</span>
      <span className="text-txt-2 font-mono text-[12px]">
        {detail}
      </span>
    </div>
  );
}
