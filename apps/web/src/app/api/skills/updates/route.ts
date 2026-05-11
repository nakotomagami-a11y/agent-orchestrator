import { NextResponse } from "next/server";
import { skills } from "@agent-office/shared/services";

export async function GET() {
  try {
    return NextResponse.json(await skills.checkForUpdates());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
