import { homedir } from "node:os";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { settings } from "@agent-office/domain/services";
import { validateQuery } from "@/lib/validation";
import { settingsScanQuerySchema } from "@/lib/validation-schemas";
import { badRequest } from "@/lib/api-helpers";

const HOME = homedir();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { data: q, error } = validateQuery(settingsScanQuerySchema, url.searchParams);
  if (error) return error;

  // Resolve and contain the root path within the user's home directory.
  const root = q.root ? resolve(q.root) : HOME;
  if (root !== HOME && !root.startsWith(HOME + "/")) {
    return badRequest("root_outside_home");
  }

  const excluded = q.excluded.split(",").filter(Boolean);
  const includeExcluded = q.includeExcluded === "1";
  return NextResponse.json(settings.scanProjects(root, excluded, includeExcluded));
}
