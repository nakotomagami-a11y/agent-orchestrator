import { NextResponse } from "next/server";
import { skills } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { skillInstallSchema } from "@/lib/validation-schemas";

export async function POST(request: Request) {
  const raw: unknown = await request.json();
  const { data, error } = validateBody(skillInstallSchema, raw);
  if (error) return error;
  try {
    await skills.installSkill(data.source, data.ref, data.path, data.name);
    return NextResponse.json({ ok: true, name: data.name });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
