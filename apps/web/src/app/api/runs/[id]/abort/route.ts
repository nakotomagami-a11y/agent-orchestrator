import { NextResponse } from "next/server";
import { runs } from "@agent-office/shared/services";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const ok = runs.abortRun(id);
  return NextResponse.json({ aborted: ok });
}
