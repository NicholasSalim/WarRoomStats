// The per-IP rate-limit policy for src/proxy.ts (docs/DECISIONS.md > Security):
// which budgets a request spends, and what happens when one runs out. Pure:
// the limiter is a port (Upstash in production, an in-memory fake in tests).

/** Requests per 60 s per IP, by budget. */
export const LIMITS = {
  /** Page views: every one can call the API. */
  pages: 30,
  /**
   * Static link prefetches (see isStaticPrefetch). They don't call the API,
   * but they get their own generous budget rather than a free pass, so a
   * future Next.js change can't turn them into an unlimited back door.
   */
  prefetches: 120,
  /**
   * Searches, on top of the page budget. A new clan search downloads up to
   * 832 clans, so it's the most expensive request; paging through one search
   * is served from the cache but still counts here.
   */
  searches: 15,
} as const;

export type Budget = keyof typeof LIMITS;

/** What a limiter reports for one request (the shape @upstash/ratelimit returns). */
export interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** When the window frees up, in ms since the epoch. */
  reset: number;
  /** Background work (e.g. Redis sync) to keep alive after responding. */
  pending: Promise<unknown>;
}

export interface Limiter {
  limit(key: string): Promise<LimitResult>;
}

export type Limiters = Record<Budget, Limiter>;

export type Decision =
  | { action: "allow"; limit?: number; remaining?: number }
  /** A refused prefetch just means the page loads on click instead: a bare 429. */
  | { action: "refusePrefetch" }
  /** Show the rate-limited page with a 429 and Retry-After. */
  | { action: "refusePage"; retryAfter: number };

/** Whether Upstash Redis is configured, under either name pair Vercel's integration may use. */
export function hasRedisEnv(env: Record<string, string | undefined>): boolean {
  return Boolean(
    (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN),
  );
}

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

/**
 * Spends the request's budgets and decides its fate. `pending` must be kept
 * alive (waitUntil) whatever the decision.
 */
export async function decide(
  request: { headers: Headers; pathname: string },
  limiters: Limiters,
  nowMs: number,
): Promise<{ decision: Decision; pending: Promise<unknown> }> {
  const ip = clientIp(request.headers);

  if (isStaticPrefetch(request.headers)) {
    const r = await limiters.prefetches.limit(ip);
    return { decision: r.success ? { action: "allow" } : { action: "refusePrefetch" }, pending: r.pending };
  }

  const isSearch = request.pathname.startsWith("/search");
  const [page, search] = await Promise.all([
    limiters.pages.limit(ip),
    isSearch ? limiters.searches.limit(ip) : null,
  ]);
  const pending = Promise.all([page.pending, search?.pending]);

  // The page budget is reported first; a search refusal applies on top.
  const refused = !page.success ? page : search && !search.success ? search : null;
  if (!refused) return { decision: { action: "allow", limit: page.limit, remaining: page.remaining }, pending };
  const retryAfter = Math.max(1, Math.ceil((refused.reset - nowMs) / 1000));
  return { decision: { action: "refusePage", retryAfter }, pending };
}
