import { getTranslations } from "next-intl/server";
import { AgentForm } from "@/modules/agents/components/agent-form";

export default async function NewAgentPage() {
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("agent.title_new")}</h1>
        <span className="sub">{t("agent.new_sub")}</span>
      </div>
      <AgentForm mode="new" />
    </>
  );
}
