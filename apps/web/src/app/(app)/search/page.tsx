import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SearchView } from "@/modules/search/components/search-view";
import { Skeleton } from "@/components/ui/skeleton";

export default async function SearchPage() {
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("search_page.title")}</h1>
      </div>
      <Suspense
        fallback={
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton width="100%" height={36} />
            <div style={{ height: 8 }} />
            <Skeleton width="100%" height={48} />
            <div style={{ height: 4 }} />
            <Skeleton width="100%" height={48} />
            <div style={{ height: 4 }} />
            <Skeleton width="100%" height={48} />
          </div>
        }
      >
        <SearchView />
      </Suspense>
    </>
  );
}
