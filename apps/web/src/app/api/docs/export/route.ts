import { buildDocsExport } from "@agent-office/shared/services/docs-export";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(buildDocsExport());
}
