import { getTranslations } from "next-intl/server";
import { RunDetail } from "@/modules/runs/components/run-detail";

type Params = { params: Promise<{ id: string }> };

export default async function RunDetailPage({ params }: Params) {
  const { id } = await params;
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("run.title")}</h1>
        <span className="sub" style={{ fontFamily: "var(--font-mono)" }}>· {id}</span>
      </div>
      <RunDetail runId={id} />
    </>
  );
}
