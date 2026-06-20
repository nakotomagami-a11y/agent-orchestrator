import { NextResponse } from "next/server";
import { store } from "@agent-office/shared/services";
import { validateBody, validateQuery } from "@/lib/validation";
import { savedPromptCreateSchema, savedPromptsQuerySchema } from "@/lib/validation-schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { data, error } = validateQuery(savedPromptsQuerySchema, url.searchParams);
  if (error) return error;
  return NextResponse.json(store.getSavedPrompts({ q: data.q, category: data.category }));
}

export async function POST(request: Request) {
  const raw: unknown = await request.json();
  const { data, error } = validateBody(savedPromptCreateSchema, raw);
  if (error) return error;
  const prompt = store.createSavedPrompt({ title: data.title, body: data.body, category: data.category });
  return NextResponse.json(prompt, { status: 201 });
}
