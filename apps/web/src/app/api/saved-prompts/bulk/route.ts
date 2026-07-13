import { NextResponse } from "next/server";
import { store } from "@agent-office/domain/services";
import { validateBody } from "@/lib/validation";
import { savedPromptsBulkSchema } from "@/lib/validation-schemas";

export async function POST(request: Request) {
  const raw: unknown = await request.json();
  const { data, error } = validateBody(savedPromptsBulkSchema, raw);
  if (error) return error;
  const inserted = store.bulkInsertSavedPrompts(data.prompts);
  return NextResponse.json({ inserted });
}
