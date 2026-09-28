// Rate limiter shared across every serverless instance, backed by Upstash
// Redis over its REST API (no SDK needed). Fixed-window counter: the first
// hit in a window creates the key with an expiry, every hit increments it.
//
// Env vars (either naming works -- Vercel's Upstash integration sets the KV_*
// ones automatically, a manually created Upstash database gives UPSTASH_*):
//   UPSTASH_REDIS_REST_URL / KV_REST_API_URL
//   UPSTASH_REDIS_REST_TOKEN / KV_REST_API_TOKEN
//
// If they're missing, or Redis can't be reached, this falls back to a
// best-effort in-memory limiter. That one resets on every cold start and is
// scoped to a single instance, so it only blocks naive rapid-fire abuse.
const hits = new Map<string, number[]>();

function isRateLimitedInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);

  // Prevent unbounded growth if this instance stays warm a long time
  if (hits.size > 5000) hits.clear();

  return timestamps.length > limit;
}

export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return isRateLimitedInMemory(key, limit, windowMs);

  const redisKey = `ratelimit:${key}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["SET", redisKey, "0", "PX", String(windowMs), "NX"],
        ["INCR", redisKey],
      ]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash responded ${res.status}`);

    const [, incr] = (await res.json()) as [unknown, { result?: number; error?: string }];
    if (typeof incr?.result !== "number") throw new Error(incr?.error || "Unexpected Upstash response");
    return incr.result > limit;
  } catch (err) {
    // Never let a Redis outage take bookings down with it.
    console.error("Rate limit check failed, using in-memory fallback:", err);
    return isRateLimitedInMemory(key, limit, windowMs);
  }
}

export function clientKey(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
