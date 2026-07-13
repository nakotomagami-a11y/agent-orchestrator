import { NextResponse } from "next/server";
import { skills } from "@agent-office/domain/services";
import { log } from "@agent-office/domain/services/log";
import { serverError } from "@/lib/api-helpers";

export async function GET() {
  try {
    return NextResponse.json(skills.registrySources());
  } catch (e) {
    log.warn("skills.sources_failed", { err: String(e) });
    return serverError("skill_sources_failed");
  }
}
