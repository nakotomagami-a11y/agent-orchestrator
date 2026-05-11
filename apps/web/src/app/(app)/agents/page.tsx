import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/icon";
import { AgentList } from "@/modules/agents/components/agent-list";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";

export default async function AgentsPage() {
  const t = await getTranslations();
  return (
    <>
      <div className="toolbar">
        <h1>{t("nav.agents")}</h1>
        <span className="sub">{t("agent.list_sub")}</span>
        <div className="right">
          <Link href={PAGE_ROUTES.agentNew} className="btn sm primary">
            <Icon name="plus" /> {t("office.new_agent")}
          </Link>
        </div>
      </div>
      <AgentList />
    </>
  );
}
