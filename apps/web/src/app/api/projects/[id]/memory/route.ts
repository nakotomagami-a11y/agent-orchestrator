import { projects } from "@agent-office/shared/services";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const p = projects.readProject(id);
  if (!p) return new Response("not found", { status: 404 });
  return new Response(p.memory, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const text = await request.text();
  try {
    projects.updateProject(id, { memory: text });
    return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    const msg = String(e);
    return new Response(msg, { status: /not found/i.test(msg) ? 404 : 400 });
  }
}
