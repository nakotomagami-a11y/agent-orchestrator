import { getTranslations } from "next-intl/server";
import { ActivityFeed } from "@/modules/runs/components/activity-feed";

export default async function ActivityPage() {
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("nav.activity")}</h1>
        <span className="sub">{t("activity_page.sub")}</span>
      </div>
      <ActivityFeed />
    </>
  );
}
