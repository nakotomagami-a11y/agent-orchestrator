import { NextResponse } from "next/server";
import { db } from "@agent-office/shared/services";

const STATIC_KEYS = new Set([
  "theme",
  "active-project",
  "claude-limits",
  "performance-mode",
  "office-grid",
  "office-decorations",
  "office-agents",
  "office-grass-color",
]);

const DYNAMIC_PREFIXES = [
  "office-grid:",
  "office-decorations:",
  "office-agents:",
  "office-grass-color:",
  "office-map-custom:",
];

const MAX_VALUE_BYTES = 10 * 1024;

function isAllowedKey(key: string): boolean {
  if (STATIC_KEYS.has(key)) return true;
  return DYNAMIC_PREFIXES.some((p) => key.startsWith(p) && key.length > p.length);
}

export async function GET() {
  return NextResponse.json(db.getAllUiSettings());
}

export async function PATCH(request: Request) {
  let body: Record<string, string>;
  try { body = await request.json() as Record<string, string>; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  for (const key of Object.keys(body)) {
    if (!isAllowedKey(key)) {
      return NextResponse.json({ error: "forbidden_key", key }, { status: 400 });
    }
  }
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") continue;
    if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES) {
      return NextResponse.json({ error: "value_too_large", key, maxBytes: MAX_VALUE_BYTES }, { status: 400 });
    }
    db.setUiSetting(key, value);
  }
  return NextResponse.json({ ok: true });
}
