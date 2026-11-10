import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { LIMITS, decide, hasRedisEnv, type Budget, type Limiters } from "@/lib/rate-limit";

// Per-IP rate limits for pages that call the game API (docs/DECISIONS.md >
// Security). Every visitor shares one API token, so these protect its quota.
// The policy lives in src/lib/rate-limit.ts; this file connects it to Upstash
// and turns its decisions into responses. Skipped when Upstash isn't
// configured, e.g. in local development; production builds on Vercel refuse
// to build without it (see next.config.ts).

const PREFIXES: Record<Budget, string> = { pages: "wrs:rl", prefetches: "wrs:rl:pf", searches: "wrs:rl:search" };

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
  return { pages: limiter("pages"), prefetches: limiter("prefetches"), searches: limiter("searches") };
}

const limiters = upstashLimiters();

if (!limiters && process.env.NODE_ENV === "production") {
  console.warn("[proxy] Upstash Redis URL/token not set: rate limiting is disabled");
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!limiters) return NextResponse.next();
  const { decision, pending } = await decide(
    { headers: request.headers, pathname: request.nextUrl.pathname },
    limiters,
    Date.now(),
  );
  event.waitUntil(pending);

  switch (decision.action) {
    case "allow": {
      const res = NextResponse.next();
      if (decision.limit != null) res.headers.set("X-RateLimit-Limit", String(decision.limit));
      if (decision.remaining != null) res.headers.set("X-RateLimit-Remaining", String(decision.remaining));
      return res;
    }
    case "refusePrefetch":
      return new NextResponse(null, { status: 429 });
    case "refusePage":
      return NextResponse.rewrite(new URL("/rate-limited", request.url), {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfter) },
      });
  }
}

export const config = {
  // Pages that call the API. Static assets, images and the 429 page itself are excluded.
  matcher: ["/", "/search", "/search/players", "/leaderboards", "/clan/:path*", "/player/:path*"],
};
