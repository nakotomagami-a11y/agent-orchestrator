import { AgentDetail } from "@/modules/agents/components/agent-detail";

type Params = { params: Promise<{ id: string }> };

export default async function AgentPage({ params }: Params) {
  const { id } = await params;
  return (
    <>
      <div className="toolbar">
        <h1>Agent</h1>
        <span className="sub" style={{ fontFamily: "var(--font-mono)" }}>· {id}</span>
      </div>
      <AgentDetail id={id} />
    </>
  );
}
