import { projects } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { rosterAddSchema } from "@/lib/validation-schemas";
import { tryService } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const raw: unknown = await request.json();
  const { data, error } = validateBody(rosterAddSchema, raw);
  if (error) return error;
  return tryService(() => projects.addInstance(id, data.agentId, data.init));
}
