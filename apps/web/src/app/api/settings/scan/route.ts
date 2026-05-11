import { NextResponse } from "next/server";
import { settings } from "@agent-office/shared/services";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const root = url.searchParams.get("root") ?? "";
  const excluded = (url.searchParams.get("excluded") ?? "").split(",").filter(Boolean);
  const includeExcluded = url.searchParams.get("includeExcluded") === "1";
  return NextResponse.json(settings.scanProjects(root, excluded, includeExcluded));
}
