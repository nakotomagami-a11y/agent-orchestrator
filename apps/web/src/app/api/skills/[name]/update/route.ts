import { NextResponse } from "next/server";
import { skills } from "@agent-office/shared/services";

type Params = { params: Promise<{ name: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { name } = await params;
  try {
    const result = await skills.updateSkill(name);
    return NextResponse.json({ ok: true, name, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
