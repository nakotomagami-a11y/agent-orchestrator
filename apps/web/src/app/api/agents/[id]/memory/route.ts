import { agents } from "@agent-office/shared/services";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const text = agents.readAgentMemory(id);
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const text = await request.text();
  agents.writeAgentMemory(id, text);
  return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
