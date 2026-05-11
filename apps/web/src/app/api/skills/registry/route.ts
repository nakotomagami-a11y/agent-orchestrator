import { NextResponse } from "next/server";
import { skills } from "@agent-office/shared/services";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  try {
    const entries = await skills.fetchRegistry(force);
    return NextResponse.json(entries);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
