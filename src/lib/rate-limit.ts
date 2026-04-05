// Simple in-memory sliding window rate limiter.
// Good enough to block spam/bots — each serverless instance
// maintains its own window, which is fine at this scale.

const store = new Map<string, number[]>();

/**
 * Returns true if the request is allowed, false if rate limited.
 * @param key      Unique key (e.g. "signup:1.2.3.4")
 * @param limit    Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function isAllowed(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;

    const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= limit) return false;

    hits.push(now);
    store.set(key, hits);
    return true;
}

export function getClientIp(req: Request): string {
    const forwarded = (req as any).headers?.get?.("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return "unknown";
}
