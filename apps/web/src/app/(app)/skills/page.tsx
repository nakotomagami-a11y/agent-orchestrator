import { getTranslations } from "next-intl/server";
import { SkillsPage } from "@/modules/skills/components/skills-page";

export default async function SkillsRoute() {
  const t = await getTranslations();
  return (
    <>
      <div className="flex items-center gap-[10px] px-[18px] py-[10px] border-b border-line bg-bg-1">
        <h1 className="m-0 text-[16px] font-bold tracking-[-0.01em]">{t("nav.skills")}</h1>
        <span className="text-[12px] text-txt-3 font-[var(--font-mono)]">{t("skills_page.sub")}</span>
      </div>
      <SkillsPage />
    </>
  );
}
