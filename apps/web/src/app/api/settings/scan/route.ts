import { NextResponse } from "next/server";
import { settings } from "@agent-office/shared/services";
import { validateQuery } from "@/lib/validation";
import { settingsScanQuerySchema } from "@/lib/validation-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { data: q, error } = validateQuery(settingsScanQuerySchema, url.searchParams);
  if (error) return error;
  const excluded = q.excluded.split(",").filter(Boolean);
  const includeExcluded = q.includeExcluded === "1";
  return NextResponse.json(settings.scanProjects(q.root, excluded, includeExcluded));
}
