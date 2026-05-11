import { getTranslations } from "next-intl/server";
import { SkillsPage } from "@/modules/skills/components/skills-page";

export default async function SkillsRoute() {
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("nav.skills")}</h1>
        <span className="sub">· browse and install agent capability packages</span>
      </div>
      <SkillsPage />
    </>
  );
}
