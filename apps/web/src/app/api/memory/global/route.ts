import { agents } from "@agent-office/shared/services";

export async function GET() {
  return new Response(agents.readGlobalMemory(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function PUT(request: Request) {
  const text = await request.text();
  agents.writeGlobalMemory(text);
  return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
