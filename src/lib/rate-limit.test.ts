import { describe, expect, it } from "vitest";
import { clientIp, isStaticPrefetch } from "./rate-limit";

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
