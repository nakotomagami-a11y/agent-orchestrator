"use client";

import { useTranslations } from "next-intl";
import type { ScannedEntry } from "@agent-office/domain/types";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/text-input";
import { cn } from "@/lib/cn";

export type ProjectStepProps = {
  candidates: ScannedEntry[];
  loading: boolean;
  root: string;
  chosen: ScannedEntry | null;
  onChoose: (entry: ScannedEntry) => void;
  projectName: string;
  onProjectNameChange: (v: string) => void;
};

/** Wizard step 5: pick a scanned folder to become the user's first project. */
export function ProjectStep({ candidates, loading, root, chosen, onChoose, projectName, onProjectNameChange }: ProjectStepProps) {
  const t = useTranslations();
  return (
    <section>
      <h3 className="font-semibold m-0 mb-[6px] text-[15px]">{t("first_run.project_title")}</h3>
      <p className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]">{t("first_run.project_hint")}</p>
      <CandidateList loading={loading} candidates={candidates} root={root} chosen={chosen} onChoose={onChoose} />
      {chosen ? <ProjectNameField projectName={projectName} onProjectNameChange={onProjectNameChange} /> : null}
      <p className="text-txt-3 m-0 text-[11.5px] leading-[1.5] mt-[6px] mt-2">
        {t("first_run.project_skip_hint")}
      </p>
    </section>
  );
}

function CandidateList({ loading, candidates, root, chosen, onChoose }: {
  loading: boolean;
  candidates: ScannedEntry[];
  root: string;
  chosen: ScannedEntry | null;
  onChoose: (entry: ScannedEntry) => void;
}) {
  const t = useTranslations();
  if (loading) return <p>{t("common.loading")}</p>;
  if (candidates.length === 0) {
    return (
      <p className="bg-bg-2 text-txt-3 px-[16px] py-[16px] rounded-[8px] text-[12.5px]">
        {t("first_run.project_empty", { root })}
      </p>
    );
  }
  return (
    <div className="flex flex-col overflow-y-auto gap-[4px] max-h-[280px]">
      {candidates.map((c) => (
        <CandidateRow key={c.id} entry={c} selected={chosen?.id === c.id} onChoose={() => onChoose(c)} />
      ))}
    </div>
  );
}

function CandidateRow({ entry, selected, onChoose }: { entry: ScannedEntry; selected: boolean; onChoose: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center bg-bg-1 border border-line-2 text-left cursor-pointer text-txt gap-[10px] px-[10px] py-[8px] rounded-[8px] font-[inherit] text-[13px] hover:bg-bg-2",
        selected && "bg-acc-faint [border-color:var(--acc)]",
      )}
      onClick={onChoose}
    >
      <Icon name="folder" />
      <div>
        <div className="font-medium text-[13px]">{entry.name}</div>
        <div className="text-txt-3 text-[11.5px] mt-[2px] leading-[1.4]">{entry.fullPath}</div>
      </div>
    </button>
  );
}

function ProjectNameField({ projectName, onProjectNameChange }: { projectName: string; onProjectNameChange: (v: string) => void }) {
  const t = useTranslations();
  return (
    <div className="mt-2.5">
      <label className="text-txt-3 m-0 mb-[12px] text-[12.5px] leading-[1.5]" htmlFor="fr-project-name">
        {t("first_run.project_name_label")}
      </label>
      <TextInput
        id="fr-project-name"
        value={projectName}
        onChange={(e) => onProjectNameChange(e.target.value)}
      />
    </div>
  );
}
