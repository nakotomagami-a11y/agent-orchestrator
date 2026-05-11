import { NextResponse } from "next/server";
import { store } from "@agent-office/shared/services";

export async function GET() {
  return NextResponse.json(store.getAllRecentPrompts());
}
