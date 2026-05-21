import { NextResponse } from "next/server";
import { runs, store } from "@agent-office/shared/services";
import { notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  // Check in-flight runs first - a just-started run lives only in memory
  // until it finishes and gets written to runs.log.
  const live = runs.getLiveRunAsPersistedRun(id);
  if (live) return NextResponse.json(live);
  const run = store.getRun(id);
  if (!run) return notFound();
  return NextResponse.json(run);
}
