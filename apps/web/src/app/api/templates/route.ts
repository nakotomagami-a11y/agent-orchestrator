import { NextResponse } from "next/server";
import { templates } from "@agent-office/shared/services";

export async function GET() {
  return NextResponse.json(templates.AGENT_TEMPLATES);
}
