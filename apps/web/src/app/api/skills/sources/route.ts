import { NextResponse } from "next/server";
import { skills } from "@agent-office/shared/services";

export async function GET() {
  return NextResponse.json(skills.registrySources());
}
