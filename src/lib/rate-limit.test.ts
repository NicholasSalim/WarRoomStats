import { describe, expect, it } from "vitest";
import { clientIp, decide, hasRedisEnv, isStaticPrefetch, type Limiter } from "./rate-limit";

const h = (init: Record<string, string>) => new Headers(init);

describe("isStaticPrefetch", () => {
  it("accepts the static prefetches Next.js links send", () => {
    expect(isStaticPrefetch(h({ rsc: "1", "next-router-prefetch": "1" }))).toBe(true);
    expect(isStaticPrefetch(h({ rsc: "1", "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree" }))).toBe(true);
    expect(isStaticPrefetch(h({ rsc: "1", "next-router-prefetch": "3" }))).toBe(true);
  });

  it("counts anything that can render data as a page view", () => {
    // A forged header on a normal page request renders the full page.
    expect(isStaticPrefetch(h({ "next-router-prefetch": "1" }))).toBe(false);
    // Runtime prefetches render URL data, and any client can ask for one.
    expect(isStaticPrefetch(h({ rsc: "1", "next-router-prefetch": "2" }))).toBe(false);
    // Client-side navigations.
    expect(isStaticPrefetch(h({ rsc: "1" }))).toBe(false);
    expect(isStaticPrefetch(h({ rsc: "1", "next-router-prefetch": "yes" }))).toBe(false);
    expect(isStaticPrefetch(h({}))).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address, then x-real-ip", () => {
    expect(clientIp(h({ "x-forwarded-for": " 1.2.3.4 , 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(h({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

/** In-memory fixed-window limiter: the test adapter for the Limiter port. */
function memoryLimiter(max: number, windowMs = 60_000, now = () => 0) {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  const limiter: Limiter = {
    async limit(key) {
      keys.push(key);
      const used = (counts.get(key) ?? 0) + 1;
      counts.set(key, used);
      return { success: used <= max, limit: max, remaining: Math.max(0, max - used), reset: now() + windowMs, pending: Promise.resolve() };
    },
  };
  return Object.assign(limiter, { keys });
}

function limiters(pages = 3, prefetches = 3, searches = 1) {
  return { pages: memoryLimiter(pages), prefetches: memoryLimiter(prefetches), searches: memoryLimiter(searches) };
}

const page = (pathname: string, headers: Record<string, string> = {}) => ({
  pathname,
  headers: h({ "x-forwarded-for": "1.2.3.4", ...headers }),
});
const prefetch = (pathname: string) => page(pathname, { rsc: "1", "next-router-prefetch": "1" });

describe("decide", () => {
  it("allows page views within the budget and reports what's left", async () => {
    const l = limiters();
    expect((await decide(page("/clan/2PP"), l, 0)).decision).toEqual({ action: "allow", limit: 3, remaining: 2 });
    expect(l.pages.keys).toEqual(["1.2.3.4"]);
    expect(l.searches.keys).toEqual([]);
  });

  it("refuses page views past the budget with a Retry-After of at least 1 s", async () => {
    const l = limiters(1);
    await decide(page("/"), l, 0);
    expect((await decide(page("/"), l, 59_500)).decision).toEqual({ action: "refusePage", retryAfter: 1 });
    expect((await decide(page("/"), l, 0)).decision).toEqual({ action: "refusePage", retryAfter: 60 });
  });

  it("charges searches to both the page and search budgets", async () => {
    const l = limiters(10, 10, 1);
    expect((await decide(page("/search"), l, 0)).decision.action).toBe("allow");
    expect((await decide(page("/search/players"), l, 0)).decision.action).toBe("refusePage");
    expect(l.pages.keys).toHaveLength(2);
    // Other pages still work.
    expect((await decide(page("/leaderboards"), l, 0)).decision.action).toBe("allow");
  });

  it("gives static prefetches their own budget and refuses them bare", async () => {
    const l = limiters(1, 1);
    expect((await decide(prefetch("/clan/2PP"), l, 0)).decision).toEqual({ action: "allow" });
    expect((await decide(prefetch("/clan/2PP"), l, 0)).decision).toEqual({ action: "refusePrefetch" });
    expect(l.pages.keys).toEqual([]);
    // Page views are unaffected.
    expect((await decide(page("/clan/2PP"), l, 0)).decision.action).toBe("allow");
  });

  it("counts runtime prefetches as page views", async () => {
    const l = limiters();
    await decide(page("/player/2PP", { rsc: "1", "next-router-prefetch": "2" }), l, 0);
    expect(l.pages.keys).toHaveLength(1);
    expect(l.prefetches.keys).toEqual([]);
  });
});

describe("hasRedisEnv", () => {
  it("accepts either name pair, only when complete", () => {
    expect(hasRedisEnv({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })).toBe(true);
    expect(hasRedisEnv({ KV_REST_API_URL: "u", KV_REST_API_TOKEN: "t" })).toBe(true);
    expect(hasRedisEnv({ UPSTASH_REDIS_REST_URL: "u", KV_REST_API_TOKEN: "t" })).toBe(false);
    expect(hasRedisEnv({})).toBe(false);
  });
});
