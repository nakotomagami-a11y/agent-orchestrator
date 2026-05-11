import { projects } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { rosterPatchSchema } from "@/lib/validation-schemas";
import { tryService } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; instanceId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, instanceId } = await params;
  const raw: unknown = await request.json();
  const { data, error } = validateBody(rosterPatchSchema, raw);
  if (error) return error;
  return tryService(() => projects.patchInstance(id, instanceId, data));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, instanceId } = await params;
  return tryService(() => projects.removeInstance(id, instanceId));
}
