import { NextResponse } from "next/server";
import { paths } from "@agent-office/shared/services";
import { handleUpload, listDirUploads } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(listDirUploads(paths.projectUploadsDir(id)));
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleUpload(request, paths.projectUploadsDir(id));
}
