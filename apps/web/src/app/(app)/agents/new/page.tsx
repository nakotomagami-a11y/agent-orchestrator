import { AgentForm } from "@/modules/agents/components/agent-form";

export default function NewAgentPage() {
  return (
    <>
      <div className="toolbar">
        <h1>New agent</h1>
        <span className="sub">· write a fresh markdown definition</span>
      </div>
      <AgentForm mode="new" />
    </>
  );
}
