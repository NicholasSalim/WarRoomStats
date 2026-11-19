import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isImpossibleTagPath } from "@/lib/coc/tag";
import { LIMITS, decide, hasRedisEnv, type Budget, type Limiters } from "@/lib/rate-limit";

// Per-IP rate limits for pages that call the game API (docs/DECISIONS.md >
// Security). Every visitor shares one API token, so these protect its quota.
// The policy lives in src/lib/rate-limit.ts; this file connects it to Upstash
// and turns its decisions into responses. Skipped when Upstash isn't
// configured, e.g. in local development; production builds on Vercel refuse
// to build without it (see next.config.ts).

const PREFIXES: Record<Budget, string> = { pages: "wrs:rl", searches: "wrs:rl:search" };

function upstashLimiters(): Limiters | null {
  if (!hasRedisEnv(process.env)) return null;
  // Redis.fromEnv() reads UPSTASH_REDIS_REST_* or, as set by Vercel's Upstash
  // integration, KV_REST_API_*.
  const redis = Redis.fromEnv();
  const limiter = (budget: Budget) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LIMITS[budget], "60 s"),
      prefix: PREFIXES[budget],
      analytics: false,
      timeout: 1000, // Fail open if Redis is slow.
    });
  return { pages: limiter("pages"), searches: limiter("searches") };
}

const limiters = upstashLimiters();

if (!limiters && process.env.NODE_ENV === "production") {
  console.warn("[proxy] Upstash Redis URL/token not set: rate limiting is disabled");
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // A clan or player page for a tag that can't exist: a real 404, and no API
  // call or rate-limit spend. Pages stream, so they can't set it themselves.
  if (isImpossibleTagPath(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/invalid-tag", request.url), { status: 404 });
  }
  if (!limiters) return NextResponse.next();
  const { decision, pending } = await decide(
    { headers: request.headers, pathname: request.nextUrl.pathname },
    limiters,
    Date.now(),
  );
  event.waitUntil(pending);

  if (decision.action === "unchecked") {
    console.error("[proxy] rate limiter failed, letting the request through:", decision.error);
    return NextResponse.next();
  }
  if (decision.action === "allow") {
    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Limit", String(decision.limit));
    res.headers.set("X-RateLimit-Remaining", String(decision.remaining));
    return res;
  }
  return NextResponse.rewrite(new URL("/rate-limited", request.url), {
    status: 429,
    headers: { "Retry-After": String(decision.retryAfter) },
  });
}

// Which requests are rate-limited. Pages that call the API, each listed twice
// so that only *static link prefetches* skip the proxy: an RSC request
// (`rsc: 1`) whose `next-router-prefetch` is 1 or 3. Those return the route's
// prerendered shell (served from the CDN, no API calls; checked on a
// production build, 2026-11-10), and a page full of player links makes dozens
// of them. Everything else runs the proxy and counts as a page view:
// - the first entry of a pair: not an RSC request (`rsc` isn't "1"), e.g. a
//   document load, or a forged prefetch header, which renders the full page;
// - the second: an RSC request that isn't a static prefetch, e.g. a click
//   (no prefetch header) or a runtime prefetch (`2`), which renders URL data.
// The check has to live here: Next.js strips these headers from the request
// the proxy function sees (docs: proxy.md, "Flight headers"). Values are
// anchored regular expressions (`^value$`, so "1|3" would also match "11";
// hence "[13]"); entries are alternatives. Must stay literal
// so Next can read it at build time.
export const config = {
  matcher: [
    { source: "/", missing: [{ type: "header", key: "rsc", value: "1" }] },
    { source: "/", missing: [{ type: "header", key: "next-router-prefetch", value: "[13]" }] },
    { source: "/search", missing: [{ type: "header", key: "rsc", value: "1" }] },
    { source: "/search", missing: [{ type: "header", key: "next-router-prefetch", value: "[13]" }] },
    { source: "/search/players", missing: [{ type: "header", key: "rsc", value: "1" }] },
    { source: "/search/players", missing: [{ type: "header", key: "next-router-prefetch", value: "[13]" }] },
    { source: "/leaderboards", missing: [{ type: "header", key: "rsc", value: "1" }] },
    { source: "/leaderboards", missing: [{ type: "header", key: "next-router-prefetch", value: "[13]" }] },
    { source: "/clan/:path*", missing: [{ type: "header", key: "rsc", value: "1" }] },
    { source: "/clan/:path*", missing: [{ type: "header", key: "next-router-prefetch", value: "[13]" }] },
    { source: "/player/:path*", missing: [{ type: "header", key: "rsc", value: "1" }] },
    { source: "/player/:path*", missing: [{ type: "header", key: "next-router-prefetch", value: "[13]" }] },
  ],
};
