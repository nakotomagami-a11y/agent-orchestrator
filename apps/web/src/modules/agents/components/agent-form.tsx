"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card-header";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";
import { EMPTY_FORM, type AgentFormValues, type FormError, slugifyId, toBody, validateForm } from "../utils/agent-form";
import { useCreateAgent, useDeleteAgent, useWriteAgent } from "../hooks/use-agents";
import { UnitPicker } from "@/components/ui/unit-picker";
import { Button } from "@/components/ui/button";

export type AgentFormProps = {
  initial?: AgentFormValues;
  /** Locks the id input (edit mode). */
  mode: "new" | "edit";
  /** When provided, fires after a successful save instead of navigating. */
  onSaved?: (id: string) => void;
  /** When provided, fires on Cancel instead of `router.back()`. */
  onCancel?: () => void;
  /** When provided, fires after a successful delete instead of navigating. */
  onDeleted?: () => void;
  /** Hide the Cancel button (useful inside modals with their own close UI). */
  hideCancel?: boolean;
};

const MODEL_SUGGESTIONS = ["haiku", "sonnet", "opus", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"] as const;
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
const PERMS = ["ask", "plan", "auto"] as const;

export function AgentForm({ initial, mode, onSaved, onCancel, onDeleted, hideCancel = false }: AgentFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState<AgentFormValues>(initial ?? EMPTY_FORM);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const createMut = useCreateAgent();
  const writeMut = useWriteAgent();
  const deleteMut = useDeleteAgent();

  const update = <K extends keyof AgentFormValues>(key: K) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errs = validateForm(values);
    setErrors(errs);
    if (errs.length > 0) return;

    const body = toBody(values);
    const onSuccess = ({ id }: { id: string }) => {
      if (onSaved) onSaved(id);
      else router.push(PAGE_ROUTES.agent(id));
    };
    const onError = (err: unknown) => setServerError(err instanceof Error ? err.message : String(err));

    if (mode === "new") createMut.mutate(body, { onSuccess, onError });
    else writeMut.mutate(body, { onSuccess, onError });
  };

  const onDelete = () => {
    if (mode !== "edit") return;
    if (!window.confirm(t("agent_form.delete_confirm", { id: values.id }))) return;
    deleteMut.mutate(values.id, {
      onSuccess: () => {
        if (onDeleted) onDeleted();
        else router.push(PAGE_ROUTES.agents);
      },
      onError: (err) => setServerError(err instanceof Error ? err.message : String(err)),
    });
  };

  const errorFor = (field: keyof AgentFormValues) => errors.find((e) => e.field === field)?.message;
  const isPending = createMut.isPending || writeMut.isPending;

  return (
    <form onSubmit={onSubmit} className="overflow-auto py-[18px] px-6 flex flex-col gap-[14px]">
      <Card>
        <CardHeader title={mode === "new" ? t("agent_form.title_new") : t("agent_form.title_edit", { id: values.id })} />
        <div className="p-4 grid grid-cols-2 gap-3">
          <Field label={t("agent_form.label_name")} error={errorFor("name")}>
            <TextInput
              value={values.name}
              onChange={(e) => {
                const name = e.target.value;
                setValues((v) => ({ ...v, name, id: mode === "new" ? slugifyId(name) : v.id }));
              }}
              placeholder={t("agent_form.placeholder_name")}
              autoFocus={mode === "new"}
            />
          </Field>
          <Field label={t("agent_form.label_id")} error={errorFor("id")}>
            <TextInput
              value={values.id}
              onChange={update("id")}
              placeholder={t("agent_form.placeholder_id")}
              disabled={mode === "edit"}
            />
          </Field>
          <Field label={t("agent_form.label_desc")} error={errorFor("desc")} span={2}>
            <TextInput
              value={values.desc}
              onChange={update("desc")}
              placeholder={t("agent_form.placeholder_desc")}
            />
          </Field>
          <SectionDivider label="Runtime" />
          <Field label={t("agent_form.label_model")}>
            <TextInput
              value={values.model}
              onChange={update("model")}
              list="model-suggestions"
              placeholder="sonnet"
            />
            <datalist id="model-suggestions">
              {MODEL_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label={t("agent_form.label_effort")}>
            <Select value={values.effort} onChange={update("effort")}>
              {EFFORTS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("agent_form.label_pm")}>
            <Select value={values.pm} onChange={update("pm")}>
              {PERMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("agent_form.label_room")}>
            <TextInput value={values.room} onChange={update("room")} placeholder={t("agent_form.placeholder_room")} />
          </Field>
          <SectionDivider label="Capabilities" />
          <Field label={t("agent_form.label_skills")} span={2}>
            <TextInput value={values.skills} onChange={update("skills")} placeholder={t("agent_form.placeholder_skills")} />
          </Field>
          <Field label={t("agent_form.label_tools")} span={2}>
            <TextInput value={values.tools} onChange={update("tools")} placeholder={t("agent_form.placeholder_tools")} />
          </Field>
          <SectionDivider label="Appearance" />
          <Field label="Avatar" span={2}>
            <UnitPicker
              value={values.unit}
              onChange={(v) => setValues((prev) => ({ ...prev, unit: v }))}
              agentName={values.name}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("agent_form.card_prompt_title")} sub={t("agent_form.card_prompt_sub")} />
        <div className="p-4">
          <Textarea
            value={values.body}
            onChange={update("body")}
            rows={18}
            invalid={!!errorFor("body")}
            placeholder={t("agent_form.placeholder_body")}
          />
          {errorFor("body") ? <FieldError message={errorFor("body")!} /> : null}
        </div>
      </Card>

      {serverError ? (
        <div className="px-[14px] py-3 rounded-[14px] bg-[var(--error)] border-0 text-white text-[14px] leading-[1.55] whitespace-pre-wrap max-w-full" role="alert">
          {serverError}
        </div>
      ) : null}

      <div className="flex gap-2 justify-between">
        {mode === "edit" ? (
          <Button variant="danger" onClick={onDelete} disabled={deleteMut.isPending}>
            <Icon name="x" /> {t("common.delete")}
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          {hideCancel ? null : (
            <Button
              variant="ghost"
              onClick={() => (onCancel ? onCancel() : router.back())}
              disabled={isPending}
            >
              {t("agent_form.cancel")}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-[10px] mt-[6px] -mb-1">
      <div className="flex-1 h-px bg-line" />
      <span className="text-[9.5px] font-mono uppercase tracking-[0.1em] text-txt-4 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

function Field({ label, error, span = 1, children }: { label: string; error?: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : "col-span-1"}`}>
      <span className="text-[11px] text-txt-3 font-mono uppercase tracking-[0.06em]">
        {label}
      </span>
      {children}
      {error ? <FieldError message={error} /> : null}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return <span className="text-[11.5px] text-[var(--error)]">{message}</span>;
}
