import { getTranslations } from "next-intl/server";
import { SettingsPage } from "@/modules/settings/components/settings-page";

export default async function SettingsRoute() {
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("nav.settings")}</h1>
        <span className="sub">· local-only configuration</span>
      </div>
      <SettingsPage />
    </>
  );
}
