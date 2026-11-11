// The per-IP rate-limit policy for src/proxy.ts (docs/DECISIONS.md > Security):
// which budgets a request spends, and what happens when one runs out. Pure:
// the limiter is a port (Upstash in production, an in-memory fake in tests).
//
// Static link prefetches never reach the proxy: its matcher skips them (see
// proxy.ts), because Next.js strips the prefetch headers from the request the
// proxy sees, so it couldn't tell them apart from page views.

/** Requests per 60 s per IP, by budget. */
export const LIMITS = {
  /** Page views and client-side navigations: every one can call the API. */
  pages: 30,
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
  | { action: "allow"; limit: number; remaining: number }
  /** Show the rate-limited page with a 429 and Retry-After. */
  | { action: "refuse"; retryAfter: number };

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
 * Spends the request's budgets and decides its fate. `pending` must be kept
 * alive (waitUntil) whatever the decision.
 */
export async function decide(
  request: { headers: Headers; pathname: string },
  limiters: Limiters,
  nowMs: number,
): Promise<{ decision: Decision; pending: Promise<unknown> }> {
  const ip = clientIp(request.headers);
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
  return { decision: { action: "refuse", retryAfter }, pending };
}
