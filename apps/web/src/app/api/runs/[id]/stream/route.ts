import { runs } from "@agent-office/shared/services";
import { createSseStream, SSE_HEADERS } from "@/lib/sse";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { stream, writer } = createSseStream();

  const emit: runs.SseEmit = (event) => writer.write(event.name, event.data);
  const attached = runs.attachEmit(id, emit);
  if (!attached) {
    await writer.write("error", { runId: id, message: `unknown run: ${id}` });
    await writer.write("done", { runId: id, exitCode: 1 });
    await writer.close();
  }

  request.signal.addEventListener("abort", () => {
    runs.detachEmit(id, emit);
    void writer.close();
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
