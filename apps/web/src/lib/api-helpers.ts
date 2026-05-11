import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Buffer } from "node:buffer";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function notFound(message = "not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message = "bad request"): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Wraps a service call. If it throws, maps "not found" → 404, anything else → 400.
 * Intended for write paths where exceptions are the natural error mechanism.
 */
export async function tryService<T>(fn: () => Promise<T> | T): Promise<NextResponse> {
  try {
    const result = await fn();
    return NextResponse.json(result);
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/not found/i.test(msg)) return notFound(msg);
    return badRequest(msg);
  }
}

export function safeFilename(name: string): string {
  return name.replace(/[/\\\0]+/g, "_").replace(/^\.+/, "").slice(0, 200) || "file";
}

export function listDirUploads(dir: string): Array<{ filename: string; path: string; size: number }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => {
      const p = join(dir, f);
      return { filename: f, path: p, size: statSync(p).size };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export async function handleUpload(
  request: Request,
  dir: string,
): Promise<NextResponse> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("missing file");
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `file too large (${file.size} > ${MAX_UPLOAD_BYTES})` },
      { status: 413 },
    );
  }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = safeFilename(file.name);
  const path = join(dir, filename);
  const buf = await file.arrayBuffer();
  writeFileSync(path, Buffer.from(buf));
  return NextResponse.json({ filename, path, size: file.size });
}

export function handleDeleteUpload(dir: string, filename: string): NextResponse {
  const safe = safeFilename(filename);
  const path = join(dir, safe);
  if (!existsSync(path)) return notFound();
  rmSync(path);
  return NextResponse.json({ deleted: safe });
}

/** Add a Cache-Control header for read-only GETs. */
export function cachedJson(data: unknown, maxAgeSeconds: number): NextResponse {
  const res = NextResponse.json(data);
  res.headers.set("Cache-Control", `private, max-age=${maxAgeSeconds}`);
  return res;
}
