import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { AgentList } from "@/modules/agents/components/agent-list";
import { PAGE_ROUTES } from "@agent-office/domain/config/routes";

export default async function AgentsPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader
        title={t("nav.agents")}
        sub={`· ${t("agent.list_sub")}`}
        actions={
          <Link
            href={PAGE_ROUTES.agentNew}
            className="inline-flex items-center gap-[6px] bg-acc font-semibold px-[14px] py-[8px] text-white rounded-[9px] text-[13px] transition-[background] duration-[120ms] hover:bg-[var(--acc-hover)] no-underline"
          >
            <Icon name="plus" size={13} /> {t("office.new_agent")}
          </Link>
        }
      />
      <AgentList />
    </>
  );
}
