// Best-effort in-memory rate limiter. This resets on every cold start and is
// scoped to a single serverless instance, so it does NOT stop a determined,
// distributed attacker -- it only blocks naive rapid-fire abuse from one
// warm instance. For real protection under load, replace with a shared
// store (e.g. Upstash/Vercel KV) keyed the same way.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);

  // Prevent unbounded growth if this instance stays warm a long time
  if (hits.size > 5000) hits.clear();

  return timestamps.length > limit;
}

export function clientKey(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
