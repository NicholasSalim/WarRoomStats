import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clientIp, isStaticPrefetch } from "@/lib/rate-limit";

// Per-IP rate limits for pages that call the game API (docs/DECISIONS.md >
// Security). Every visitor shares one API token, so these protect its quota.
// Skipped when Upstash isn't configured, e.g. in local development; production
// builds on Vercel refuse to build without it (see next.config.ts).

// Redis.fromEnv() reads UPSTASH_REDIS_REST_* or, as set by Vercel's Upstash
// integration, KV_REST_API_*.
const redis =
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    ? Redis.fromEnv()
    : null;

function limiter(prefix: string, requests: number) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, "60 s"),
    prefix,
    analytics: false,
    timeout: 1000, // Fail open if Redis is slow.
  });
}

/** Page views: about 30 a minute per IP. */
const pages = limiter("wrs:rl", 30);
/**
 * Static link prefetches (see isStaticPrefetch). They don't call the API,
 * but they get their own generous budget rather than a free pass, so a
 * future Next.js change can't turn them into an unlimited back door.
 */
const prefetches = limiter("wrs:rl:pf", 120);
/**
 * Searches, on top of the page limit. A new clan search downloads up to 832
 * clans, so it's the most expensive request; paging through one search is
 * served from the cache but still counts here.
 */
const searches = limiter("wrs:rl:search", 15);

if (!redis && process.env.NODE_ENV === "production") {
  console.warn("[proxy] Upstash Redis URL/token not set: rate limiting is disabled");
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!pages || !prefetches || !searches) return NextResponse.next();
  const ip = clientIp(request.headers);

  if (isStaticPrefetch(request.headers)) {
    const { success, pending } = await prefetches.limit(ip);
    event.waitUntil(pending);
    // A refused prefetch just means the page loads on click instead.
    return success ? NextResponse.next() : new NextResponse(null, { status: 429 });
  }

  const isSearch = request.nextUrl.pathname.startsWith("/search");
  const [page, search] = await Promise.all([pages.limit(ip), isSearch ? searches.limit(ip) : null]);
  event.waitUntil(Promise.all([page.pending, search?.pending]));

  const refused = !page.success ? page : search && !search.success ? search : null;
  if (!refused) {
    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Limit", String(page.limit));
    res.headers.set("X-RateLimit-Remaining", String(page.remaining));
    return res;
  }
  const retryAfter = Math.max(1, Math.ceil((refused.reset - Date.now()) / 1000));
  return NextResponse.rewrite(new URL("/rate-limited", request.url), {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
  });
}

export const config = {
  // Pages that call the API. Static assets, images and the 429 page itself are excluded.
  matcher: ["/", "/search", "/search/players", "/leaderboards", "/clan/:path*", "/player/:path*"],
};
