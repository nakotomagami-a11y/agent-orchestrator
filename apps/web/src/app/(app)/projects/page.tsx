import { getTranslations } from "next-intl/server";
import { ProjectsList } from "@/modules/projects/components/projects-list";

export default async function ProjectsRoute() {
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("nav.projects")}</h1>
        <span className="sub">· scanned from your projects root</span>
      </div>
      <ProjectsList />
    </>
  );
}
