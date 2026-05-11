import { NextResponse } from "next/server";
import { settings } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { settingsPatchSchema } from "@/lib/validation-schemas";

export async function GET() {
  return NextResponse.json(settings.readSettings());
}

export async function PUT(request: Request) {
  const raw: unknown = await request.json();
  const { data, error } = validateBody(settingsPatchSchema, raw);
  if (error) return error;
  const next = {
    projectsRoot: data.projectsRoot.trim(),
    excluded: data.excluded.filter((s) => typeof s === "string"),
    firstRunComplete: true,
  };
  settings.writeSettings(next);
  return NextResponse.json(next);
}
