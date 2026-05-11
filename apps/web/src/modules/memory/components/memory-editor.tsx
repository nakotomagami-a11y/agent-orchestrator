"use client";

import { Textarea } from "@/components/ui/textarea";
import { useMemoryDraft } from "../hooks/use-memory-draft";

export type MemoryEditorProps = {
  value: string;
  onSave: (content: string) => Promise<unknown> | unknown;
  label?: string;
  placeholder?: string;
  rows?: number;
  saveLabel?: string;
  savingLabel?: string;
  savedLabel?: string;
};

export function MemoryEditor({
  value,
  onSave,
  label,
  placeholder,
  rows = 14,
  saveLabel = "Save",
  savingLabel = "Saving…",
  savedLabel = "Saved.",
}: MemoryEditorProps) {
  const draft = useMemoryDraft({ initialValue: value, onSave });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Textarea
        value={draft.draft}
        onChange={(e) => draft.setDraft(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-label={label}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <span
          aria-live="polite"
          style={{
            fontSize: 12,
            color: "var(--done)",
            fontFamily: "var(--font-mono)",
            minHeight: 16,
            opacity: draft.savedRecently ? 1 : 0,
            transition: "opacity 200ms",
          }}
        >
          {savedLabel}
        </span>
        <button
          type="button"
          className="btn primary"
          disabled={!draft.isDirty || draft.isSaving}
          onClick={() => {
            void draft.save();
          }}
        >
          {draft.isSaving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}
