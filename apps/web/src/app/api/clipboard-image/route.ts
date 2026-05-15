import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Reads the current clipboard image directly from the Wayland compositor via
// wl-paste, bypassing WebKit2GTK's clipboard cache which causes stale images
// on repeated pastes inside Tauri.
export async function POST(): Promise<NextResponse> {
  const result = spawnSync("wl-paste", ["--no-newline", "-t", "image/png"], {
    timeout: 3000,
    env: process.env,
  });

  if (result.error || result.status !== 0 || !result.stdout || result.stdout.length === 0) {
    return NextResponse.json({ error: "No image in clipboard" }, { status: 404 });
  }

  const buf: Buffer = result.stdout as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: { "Content-Type": "image/png" },
  });
}
