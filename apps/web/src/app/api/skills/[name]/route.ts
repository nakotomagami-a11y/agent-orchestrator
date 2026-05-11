import { NextResponse } from "next/server";
import { skills } from "@agent-office/shared/services";
import { notFound } from "@/lib/api-helpers";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  const skill = skills.readInstalledSkill(name);
  if (!skill) return notFound();
  return NextResponse.json(skill);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { name } = await params;
  return NextResponse.json({ removed: skills.uninstallSkill(name) });
}
