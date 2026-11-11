import { describe, expect, it } from "vitest";
// Next's own has/missing check, as used to decide whether the proxy runs.
import { matchHas } from "next/dist/shared/lib/router/utils/prepare-destination";
import { config } from "./proxy";

type Condition = { type: "header"; key: string; value?: string };
type Entry = { source: string; missing?: Condition[]; has?: Condition[] };
const entries = config.matcher as Entry[];

/** Whether the proxy (rate limiter) runs for a request to `source` with these headers. */
function proxyRuns(source: string, headers: Record<string, string>): boolean {
  const req = { headers, cookies: {} } as unknown as Parameters<typeof matchHas>[0];
  return entries
    .filter((e) => e.source === source)
    .some((e) => matchHas(req, {}, e.has ?? [], e.missing ?? []) !== false);
}

const SOURCES = ["/", "/search", "/search/players", "/leaderboards", "/clan/:path*", "/player/:path*"];

describe("proxy matcher", () => {
  it.each(SOURCES)("rate-limits page views and clicks on %s", (source) => {
    expect(proxyRuns(source, {})).toBe(true); // document load
    expect(proxyRuns(source, { rsc: "1" })).toBe(true); // client-side navigation
  });

  it.each(SOURCES)("lets static link prefetches of %s through", (source) => {
    expect(proxyRuns(source, { rsc: "1", "next-router-prefetch": "1" })).toBe(false);
    expect(proxyRuns(source, { rsc: "1", "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree" })).toBe(false);
    expect(proxyRuns(source, { rsc: "1", "next-router-prefetch": "3" })).toBe(false);
  });

  it.each(SOURCES)("rate-limits anything on %s that can render data", (source) => {
    // Runtime prefetches render URL data.
    expect(proxyRuns(source, { rsc: "1", "next-router-prefetch": "2" })).toBe(true);
    // A prefetch header on a non-RSC request renders the full page.
    expect(proxyRuns(source, { "next-router-prefetch": "1" })).toBe(true);
    expect(proxyRuns(source, { rsc: "0", "next-router-prefetch": "1" })).toBe(true);
    // Values are matched whole, not as substrings.
    expect(proxyRuns(source, { rsc: "1", "next-router-prefetch": "11" })).toBe(true);
    expect(proxyRuns(source, { rsc: "11", "next-router-prefetch": "1" })).toBe(true);
  });
});
