import { projects } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { rosterAddSchema } from "@/lib/validation-schemas";
import { tryService, validateIdParam } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { value: id, error: paramError } = validateIdParam((await params).id);
  if (paramError) return paramError;
  const raw: unknown = await request.json();
  const { data, error } = validateBody(rosterAddSchema, raw);
  if (error) return error;
  return tryService(() => projects.addInstance(id, data.agentId, data.init));
}
