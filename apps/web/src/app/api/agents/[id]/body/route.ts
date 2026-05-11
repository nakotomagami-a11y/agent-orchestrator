import { agents } from "@agent-office/shared/services";
import { notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const agent = agents.readAgent(id);
  if (!agent) return notFound();
  return new Response(agent.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
