import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { agents } from "@agent-office/shared/services";
import { AgentForm } from "@/modules/agents/components/agent-form";
import { fromApi } from "@/modules/agents/utils/agent-form";

type Params = { params: Promise<{ id: string }> };

export default async function EditAgentPage({ params }: Params) {
  const { id } = await params;
  const found = agents.readAgent(id);
  if (!found) notFound();
  const t = await getTranslations();
  const initial = fromApi(found.info, found.body);
  return (
    <>
      <div className="toolbar">
        <h1>{t("agent.title_edit")}</h1>
        <span className="sub" style={{ fontFamily: "var(--font-mono)" }}>· {id}</span>
      </div>
      <AgentForm initial={initial} mode="edit" />
    </>
  );
}
