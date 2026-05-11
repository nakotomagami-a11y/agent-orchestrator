import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const LIMIT = 60;
const MAX_BUCKETS = 1024;

const buckets = new Map<string, { count: number; resetAt: number }>();

function clientId(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

function pruneExpired(now: number): void {
  for (const [id, b] of buckets) {
    if (b.resetAt < now) buckets.delete(id);
  }
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    const it = buckets.keys();
    for (let i = 0; i < overflow; i++) {
      const next = it.next();
      if (next.done) break;
      buckets.delete(next.value);
    }
  }
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const id = clientId(req);
  const now = Date.now();
  const bucket = buckets.get(id);

  if (!bucket || bucket.resetAt < now) {
    pruneExpired(now);
    buckets.set(id, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (bucket.count >= LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  bucket.count += 1;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
