import { NextResponse } from "next/server";
import { health } from "@agent-office/shared/services";

export async function GET() {
  return NextResponse.json(await health.getHealth());
}
