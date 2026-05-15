import { getTranslations } from "next-intl/server";
import { ProjectDetail } from "@/modules/projects/components/project-detail";

type Params = { params: Promise<{ id: string }> };

export default async function ProjectRoute({ params }: Params) {
  const { id } = await params;
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("project.title")}</h1>
        <span className="sub font-mono">· {id}</span>
      </div>
      <ProjectDetail id={id} />
    </>
  );
}
