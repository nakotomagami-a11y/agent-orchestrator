"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Portal } from "@/components/ui/portal";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  useSavedPrompts,
  useCreateSavedPrompt,
  useDeleteSavedPrompt,
  useRecordSavedPromptUsage,
} from "../hooks/use-saved-prompts";
import type { SavedPrompt } from "@agent-office/shared/types";

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "debugging",
  "planning",
  "review",
  "writing",
  "research",
  "testing",
  "refactoring",
  "analysis",
  "general",
] as const;

type Category = (typeof CATEGORIES)[number];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface PromptPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (body: string) => void;
}

// ── Prompt card ──────────────────────────────────────────────────────────────

function PromptCard({
  prompt,
  onSelect,
  onDelete,
}: {
  prompt: SavedPrompt;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="group relative rounded-[10px] border border-line bg-bg-1 hover:border-[var(--acc)] transition-[border-color] duration-[120ms]">
      <button
        type="button"
        className="w-full text-left px-[12px] pt-[10px] pb-[10px] pr-[36px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc rounded-[10px]"
        onClick={onSelect}
      >
        <div className="font-semibold text-[13px] text-txt leading-snug mb-[4px]">
          {prompt.title}
        </div>
        <div className="text-[12px] text-txt-2 leading-[1.45] line-clamp-2">
          {prompt.body}
        </div>
        <div className="flex items-center gap-[6px] mt-[7px]">
          <span className="inline-flex items-center px-[6px] py-[2px] rounded-full bg-bg-2 border border-line text-txt-3 text-[10.5px] font-mono">
            {capitalize(prompt.category)}
          </span>
          {prompt.useCount > 0 && (
            <span className="text-[10.5px] text-txt-4 font-mono">
              {prompt.useCount}×
            </span>
          )}
        </div>
      </button>
      {/* Delete button - visible on hover */}
      <button
        type="button"
        aria-label={t("prompts.delete_prompt_aria")}
        className="absolute top-[8px] right-[8px] w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-txt-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--error)] hover:bg-bg-2 transition-[opacity,color,background] duration-[100ms] cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

// ── Add form ─────────────────────────────────────────────────────────────────

function AddPromptForm({ onAdded }: { onAdded?: () => void }) {
  const t = useTranslations();
  const createMut = useCreateSavedPrompt();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("general");

  const canSave = title.trim().length > 0 && body.trim().length > 0;

  const handleSave = () => {
    if (!canSave || createMut.isPending) return;
    createMut.mutate(
      { title: title.trim(), body: body.trim(), category },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setCategory("general");
          onAdded?.();
        },
      },
    );
  };

  return (
    <div data-add-form className="border-t border-line px-[16px] py-[14px] flex flex-col gap-[8px]">
      <input
        type="text"
        placeholder={t("prompts.add_title_placeholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full h-[32px] px-[10px] bg-bg-2 border border-line-2 rounded-[8px] text-txt text-[12px] outline-none [font:inherit] focus:border-[var(--acc)] transition-[border-color] duration-[120ms] placeholder:text-txt-4"
      />
      <textarea
        placeholder={t("prompts.add_body_placeholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="w-full px-[10px] py-[8px] bg-bg-2 border border-line-2 rounded-[8px] text-txt text-[12px] leading-[1.5] outline-none resize-none [font:inherit] focus:border-[var(--acc)] transition-[border-color] duration-[120ms] placeholder:text-txt-4"
      />
      <div className="flex items-center gap-[8px]">
        <label className="text-[11.5px] text-txt-2 shrink-0">
          {t("prompts.add_category_label")}
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-[28px] py-0 pr-6 pl-[8px] bg-bg-2 border border-line-2 rounded-[7px] text-txt [font:inherit] text-[12px] outline-none cursor-pointer appearance-none bg-no-repeat bg-[right_6px_center] bg-[length:14px]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8079' stroke-width='1.7'><path d='m6 9 6 6 6-6'/></svg>\")",
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {capitalize(c)}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="primary"
          className="ml-auto"
          disabled={!canSave || createMut.isPending}
          onClick={handleSave}
        >
          {createMut.isPending ? t("common.saving") : t("prompts.add_save_button")}
        </Button>
      </div>
    </div>
  );
}

// ── Dialog ───────────────────────────────────────────────────────────────────

export function PromptPickerDialog({ open, onClose, onSelect }: PromptPickerDialogProps) {
  const t = useTranslations();
  const [rawSearch, setRawSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | undefined>(undefined);

  const deleteMut = useDeleteSavedPrompt();
  const recordUsage = useRecordSavedPromptUsage();

  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Debounce the search query by 200ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(rawSearch), 200);
    return () => clearTimeout(id);
  }, [rawSearch]);

  // Focus search on open; reset state on close
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 30);
    } else {
      setRawSearch("");
      setDebouncedSearch("");
      setActiveCategory(undefined);
    }
  }, [open]);

  // Escape / focus-trap
  useEffect(() => {
    if (!open) return;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // If focus is inside the add-prompt form, only blur it (don't discard
        // the user's in-progress text by closing the whole dialog).
        const inForm = !!(document.activeElement as Element | null)?.closest(
          "[data-add-form]",
        );
        if (inForm) {
          (document.activeElement as HTMLElement | null)?.blur();
          return;
        }
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const els = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => el.offsetParent !== null);
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  const promptsQ = useSavedPrompts({
    q: debouncedSearch || undefined,
    category: activeCategory,
  });

  // Sort by useCount DESC then createdAt DESC
  const sorted = useMemo(() => {
    const data = promptsQ.data ?? [];
    return [...data].sort(
      (a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt,
    );
  }, [promptsQ.data]);

  const handleSelect = (prompt: SavedPrompt) => {
    recordUsage.mutate(prompt.id);
    onSelect(prompt.body);
    onClose();
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id);
  };

  if (!open) return null;

  return (
    <Portal>
      {/* Backdrop */}
      <div
        role="presentation"
        className="fixed inset-0 bg-[rgba(20,14,12,0.55)] backdrop-blur-sm flex items-start justify-center pt-[10vh] px-[16px] z-[200]"
        onClick={onClose}
      >
        {/* Dialog panel */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("prompts.dialog_title")}
          tabIndex={-1}
          className="relative w-full max-w-[640px] max-h-[80vh] bg-bg-1 border border-line rounded-[12px] shadow-[0_4px_24px_rgba(20,12,8,0.22),0_1px_4px_rgba(20,12,8,0.12)] flex flex-col outline-none overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-[10px] px-[14px] py-[11px] border-b border-line shrink-0">
            <Icon name="sparkle" size={15} className="text-acc shrink-0" />
            <span className="font-bold text-[13px] text-txt">{t("prompts.dialog_title")}</span>
            <button
              type="button"
              aria-label={t("prompts.close_aria")}
              className="ml-auto w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-txt-3 hover:text-txt hover:bg-bg-2 transition-[color,background] duration-[100ms] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acc"
              onClick={onClose}
            >
              <Icon name="x" size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="px-[14px] pt-[10px] pb-[8px] border-b border-line shrink-0">
            <div className="relative">
              <Icon
                name="search"
                size={14}
                className="absolute left-[9px] top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder={t("prompts.search_placeholder")}
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className="w-full h-[32px] pl-[30px] pr-[10px] bg-bg-2 border border-line-2 rounded-[8px] text-txt text-[13px] outline-none [font:inherit] focus:border-[var(--acc)] transition-[border-color] duration-[120ms] placeholder:text-txt-4"
              />
              {rawSearch && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-[7px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] flex items-center justify-center text-txt-3 hover:text-txt cursor-pointer"
                  onClick={() => setRawSearch("")}
                >
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-[2px] px-[12px] py-[8px] border-b border-line shrink-0 overflow-x-auto [scrollbar-width:none]">
            <button
              type="button"
              className={cn(
                "inline-flex items-center px-[10px] h-[26px] rounded-full text-[12px] font-medium whitespace-nowrap transition-[background,color,border-color] duration-[100ms] border cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acc",
                activeCategory === undefined
                  ? "bg-acc text-[var(--acc-ink)] border-acc"
                  : "bg-transparent text-txt-2 border-transparent hover:bg-bg-2 hover:text-txt hover:border-line",
              )}
              onClick={() => setActiveCategory(undefined)}
            >
              {t("prompts.category_all")}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={cn(
                  "inline-flex items-center px-[10px] h-[26px] rounded-full text-[12px] font-medium whitespace-nowrap transition-[background,color,border-color] duration-[100ms] border cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acc",
                  activeCategory === cat
                    ? "bg-acc text-[var(--acc-ink)] border-acc"
                    : "bg-transparent text-txt-2 border-transparent hover:bg-bg-2 hover:text-txt hover:border-line",
                )}
                onClick={() =>
                  setActiveCategory((prev) => (prev === cat ? undefined : cat))
                }
              >
                {capitalize(cat)}
              </button>
            ))}
          </div>

          {/* Prompt list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-[12px] py-[10px] [scrollbar-width:thin] [scrollbar-color:var(--bg-4)_transparent]">
            {promptsQ.isLoading ? (
              <div className="text-txt-3 text-[12px] py-[20px] text-center">
                {t("common.loading")}
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center gap-[6px] py-[32px] text-center">
                <Icon name="sparkle" size={24} className="text-txt-4" />
                <div className="text-[13px] text-txt-2">{t("prompts.empty_state")}</div>
                {!rawSearch && !activeCategory && (
                  <div className="text-[12px] text-txt-3">{t("prompts.empty_add_hint")}</div>
                )}
              </div>
            ) : (
              <div className="grid gap-[6px]">
                {sorted.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onSelect={() => handleSelect(prompt)}
                    onDelete={() => handleDelete(prompt.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Add prompt form */}
          <AddPromptForm />
        </div>
      </div>
    </Portal>
  );
}
