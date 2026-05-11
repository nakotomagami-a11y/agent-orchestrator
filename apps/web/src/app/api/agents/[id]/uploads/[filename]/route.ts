import { paths } from "@agent-office/shared/services";
import { handleDeleteUpload } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; filename: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id, filename } = await params;
  return handleDeleteUpload(paths.agentUploadsDir(id), filename);
}
