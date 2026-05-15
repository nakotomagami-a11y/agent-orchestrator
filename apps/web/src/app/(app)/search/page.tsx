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
          <div className="p-6 flex flex-col gap-1.5">
            <Skeleton width="100%" height={36} />
            <div className="h-2" />
            <Skeleton width="100%" height={48} />
            <div className="h-1" />
            <Skeleton width="100%" height={48} />
            <div className="h-1" />
            <Skeleton width="100%" height={48} />
          </div>
        }
      >
        <SearchView />
      </Suspense>
    </>
  );
}
