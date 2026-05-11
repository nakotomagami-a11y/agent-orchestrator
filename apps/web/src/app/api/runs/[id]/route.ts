import { NextResponse } from "next/server";
import { store } from "@agent-office/shared/services";
import { notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const run = store.getRun(id);
  if (!run) return notFound();
  return NextResponse.json(run);
}
