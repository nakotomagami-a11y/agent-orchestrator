import { paths } from "@agent-office/shared/services";
import { handleDeleteUpload, validateIdParam } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; filename: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id, filename } = await params;
  const idCheck = validateIdParam(id);
  if (idCheck.error) return idCheck.error;
  return handleDeleteUpload(paths.projectUploadsDir(idCheck.value), filename);
}
