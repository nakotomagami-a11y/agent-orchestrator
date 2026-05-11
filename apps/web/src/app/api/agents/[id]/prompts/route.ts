import { NextResponse } from "next/server";
import { store } from "@agent-office/shared/services";
import { validateBody } from "@/lib/validation";
import { promptPostSchema } from "@/lib/validation-schemas";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(store.getRecentPrompts(id));
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const raw: unknown = await request.json();
  const { data, error } = validateBody(promptPostSchema, raw);
  if (error) return error;
  store.pushRecentPrompt(id, data.prompt);
  return NextResponse.json({ ok: true });
}
