"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemory, type MemoryScope } from "../hooks/use-memory";
import { MemoryEditor } from "./memory-editor";
import { scopeKey } from "../scope/scope";

type ScopeEditorProps = {
  scope: MemoryScope;
  onContentLoaded: (key: string, hasContent: boolean) => void;
};

export function ScopeEditor({ scope, onContentLoaded }: ScopeEditorProps) {
  const t = useTranslations("memory_page");
  const memory = useMemory(scope);

  useEffect(() => {
    if (!memory.isLoading) {
      onContentLoaded(scopeKey(scope), memory.content.trim().length > 0);
    }
  }, [memory.isLoading, memory.content, scope, onContentLoaded]);

  if (memory.isLoading) {
    return (
      <div className="flex flex-col gap-[6px] p-[20px]">
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={14} />
        <Skeleton width="70%" height={14} />
      </div>
    );
  }

  if (memory.loadError) {
    return (
      <div className="px-[14px] py-3 m-[20px] border border-status-error rounded-md text-[13px] bg-[color-mix(in_oklch,var(--error)_8%,transparent)] text-status-error">
        {memory.loadError.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-[20px]">
      <MemoryEditor
        value={memory.content}
        onSave={memory.save}
        placeholder={t("no_content")}
      />
    </div>
  );
}
