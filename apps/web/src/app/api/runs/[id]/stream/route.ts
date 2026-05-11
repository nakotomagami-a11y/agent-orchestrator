import { runs } from "@agent-office/shared/services";
import { createSseStream, SSE_HEADERS } from "@/lib/sse";
import { validateIdParam } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request, { params }: Params) {
  const { id: rawId } = await params;
  const idCheck = validateIdParam(rawId);
  if (idCheck.error) return idCheck.error;
  const id = idCheck.value;

  const { stream, writer } = createSseStream();
  const emit: runs.SseEmit = (event) => writer.write(event.name, event.data);
  const attached = runs.attachEmit(id, emit);

  if (!attached) {
    await writer.write("error", { runId: id, message: `unknown run: ${id}` });
    await writer.write("done", { runId: id, exitCode: 1 });
    await writer.close();
    return new Response(stream, { headers: SSE_HEADERS });
  }

  const heartbeat = setInterval(() => {
    if (writer.closed) return;
    void writer.writeRaw(": keepalive\n\n");
  }, HEARTBEAT_MS);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  request.signal.addEventListener("abort", () => {
    clearInterval(heartbeat);
    runs.detachEmit(id, emit);
    void writer.close();
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
