"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { type MemoryScope } from "@/modules/memory/hooks/use-memory";
import { ScopeEditor } from "@/modules/memory/components/scope-editor";
import { MemoryNav } from "@/modules/memory/components/memory-nav";
import { scopeKey } from "@/modules/memory/scope/scope";

export default function MemoryPage() {
  const t = useTranslations("memory_page");
  const [scope, setScope] = useState<MemoryScope>({ kind: "global" });
  const [contentMap, setContentMap] = useState<Map<string, boolean>>(new Map());

  const handleContentLoaded = useCallback((key: string, hasContent: boolean) => {
    setContentMap((prev) => {
      if (prev.get(key) === hasContent) return prev;
      const next = new Map(prev);
      next.set(key, hasContent);
      return next;
    });
  }, []);

  return (
    <>
      <PageHeader title={t("title")} sub="· global, project & agent memory" />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <MemoryNav selected={scope} onSelect={setScope} contentMap={contentMap} />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScopeEditor
            key={scopeKey(scope)}
            scope={scope}
            onContentLoaded={handleContentLoaded}
          />
        </div>
      </div>
    </>
  );
}
