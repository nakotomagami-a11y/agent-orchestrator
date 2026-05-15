import { getTranslations } from "next-intl/server";
import { AgentDetail } from "@/modules/agents/components/agent-detail";

type Params = { params: Promise<{ id: string }> };

export default async function AgentPage({ params }: Params) {
  const { id } = await params;
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("agent.title_view")}</h1>
        <span className="sub font-mono">· {id}</span>
      </div>
      <AgentDetail id={id} />
    </>
  );
}
