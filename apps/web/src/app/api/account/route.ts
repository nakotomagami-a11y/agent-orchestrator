import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ClaudePlan } from "@/lib/claude-limits-store";

function readPlan(): ClaudePlan {
  try {
    const raw = readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf-8");
    const creds = JSON.parse(raw) as Record<string, unknown>;
    const oauth = creds.claudeAiOauth as Record<string, unknown> | undefined;
    const sub = typeof oauth?.subscriptionType === "string" ? oauth.subscriptionType.toLowerCase() : "";
    if (sub === "max" || sub.startsWith("max")) return "max";
    if (sub === "pro") return "pro";
    if (sub === "free") return "free";
    if (sub === "api" || sub === "api_key") return "api";
  } catch {
    // file missing or unreadable — fall through
  }
  return "free";
}

export async function GET() {
  return NextResponse.json({ plan: readPlan() });
}
