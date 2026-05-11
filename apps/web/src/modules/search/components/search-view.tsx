"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { RunRow } from "@/modules/runs/components/run-row";
import { useSearchRuns } from "../hooks/use-search-runs";

export function SearchView() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { results, isLoading } = useSearchRuns(query);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) {
          params.set("q", value);
        } else {
          params.delete("q");
        }
        router.replace(`/search?${params.toString()}`);
      }, 300);
    },
    [router, searchParams],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t("search_page.placeholder")}
          aria-label={t("search_page.placeholder")}
          style={{
            flex: 1,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: "7px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--txt)",
            outline: "none",
          }}
        />
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={48} />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("search_page.no_results_title")}
          description={t("search_page.no_results_desc")}
        />
      ) : (
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--txt-3)",
              padding: "0 2px 8px",
            }}
          >
            {t("search_page.results_count", { count: results.length })}
          </div>
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
            }}
          >
            {results.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
