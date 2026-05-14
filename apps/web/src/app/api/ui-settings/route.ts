import { NextResponse } from "next/server";
import { db } from "@agent-office/shared/services";

export async function GET() {
  return NextResponse.json(db.getAllUiSettings());
}

export async function PATCH(request: Request) {
  const body = await request.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") db.setUiSetting(key, value);
  }
  return NextResponse.json({ ok: true });
}
