// Request classification for the rate limiter in src/proxy.ts. Pure, so it
// can be unit-tested without Redis.

export function clientIp(headers: Headers): string {
  // On Vercel, x-forwarded-for is set by the platform; the first entry is the client.
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/**
 * A static link prefetch, the only kind this app's links make (Partial
 * Prefetching: one App Shell per route, no URL data). Next.js sends both
 * headers. Anything else is counted as a page view, because it can call the
 * API (checked against a production build, 2026-11-10):
 * - `next-router-prefetch` without `rsc: 1` renders the full page;
 * - `next-router-prefetch: 2` (runtime prefetch) renders the player's data,
 *   and any client can ask for it.
 * Values 1 and 3 returned the shell only.
 */
export function isStaticPrefetch(headers: Headers): boolean {
  const kind = headers.get("next-router-prefetch");
  return headers.get("rsc") === "1" && (kind === "1" || kind === "3");
}
