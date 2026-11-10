import { beforeEach, describe, expect, it, vi } from "vitest";

// client.ts is server-only and uses next/cache; outside Next the `use cache`
// directive is inert, so what reaches an endpoint is exactly the cache key's
// arguments.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const seen: unknown[][] = [];
vi.mock("./endpoints", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./endpoints")>();
  const record =
    (name: string) =>
    async (_request: unknown, ...args: unknown[]) => {
      seen.push([name, ...args]);
      return { result: { ok: true, data: null }, life: "profile" };
    };
  return {
    ...actual,
    endpoints: new Proxy(actual.endpoints, { get: (_t, name: string) => record(name) }),
  };
});

const { getClan, getPlayer, getRankedGroup, searchClans } = await import("./client");

beforeEach(() => {
  seen.length = 0;
});

describe("cache keys", () => {
  it("shares one key for every spelling of a tag", async () => {
    await Promise.all([getClan("2pp"), getClan("#2PP"), getClan(" %232pp "), getClan("2PP")]);
    expect(new Set(seen.map((k) => JSON.stringify(k)))).toEqual(new Set([JSON.stringify(["clan", "#2PP"])]));
  });

  it("normalises both tags of a ranked group", async () => {
    await getRankedGroup("2qylpr9", 5, "y9qqjc9rr");
    expect(seen).toEqual([["rankedGroup", "#2QYLPR9", 5, "#Y9QQJC9RR"]]);
  });

  it("keeps invalid tags away from the cache", async () => {
    expect(await getPlayer("hello!")).toMatchObject({ ok: false, error: { kind: "invalidTag" } });
    expect(seen).toEqual([]);
  });

  it("shares one key for equivalent clan searches", async () => {
    await searchClans({ name: "War  Machine", labelIds: [56000002, 56000001] });
    await searchClans({ name: "war machine", labelIds: [56000001, 56000002, 56000001] });
    expect(seen[0]).toEqual(seen[1]);
  });
});
