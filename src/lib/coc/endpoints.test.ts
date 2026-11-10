import { describe, expect, it, vi } from "vitest";
import { endpoints, type Requester } from "./endpoints";
import { fixtureFetch } from "./fixtures";
import { cocRequest } from "./transport";

const request: Requester = (path, schema) =>
  cocRequest({ baseUrl: "mock://coc", token: "t", fetchImpl: fixtureFetch }, path, schema);

/** A requester that records paths and never answers successfully. */
function spy() {
  const paths: string[] = [];
  const req: Requester = async (path) => {
    paths.push(path);
    return { ok: false, error: { kind: "unavailable", status: 500 } };
  };
  return { req, paths };
}

describe("endpoints: lifetimes", () => {
  it("caches a profile for the profile lifetime", async () => {
    const { result, life } = await endpoints.clan(request, "#2PRGP0L22");
    expect(result.ok).toBe(true);
    expect(life).toBe("profile");
  });

  it("caches failures briefly", async () => {
    const { result, life } = await endpoints.clan(request, "#999PP");
    expect(result).toMatchObject({ ok: false, error: { kind: "maintenance" } });
    expect(life).toBe("apiError");
  });

  it("caches invalid input for good, without a request", async () => {
    const { req, paths } = spy();
    const { result, life } = await endpoints.player(req, "not a tag!");
    expect(result).toMatchObject({ ok: false, error: { kind: "invalidTag" } });
    expect(life).toBe("max");
    expect(paths).toEqual([]);
  });

  it("rejects bad locations and seasons as notFound", async () => {
    expect((await endpoints.playerRankings(request, "../x")).result).toMatchObject({
      ok: false,
      error: { kind: "notFound", reason: "badLocation" },
    });
    expect((await endpoints.legendSeasonRankings(request, "nope", 1)).result).toMatchObject({
      ok: false,
      error: { kind: "notFound", reason: "badSeason" },
    });
    expect((await endpoints.rankedGroup(request, "#2PP", 0, "#2PP")).result).toMatchObject({
      ok: false,
      error: { kind: "invalidTag" },
    });
  });
});

describe("endpoints: error remapping", () => {
  it("reports a clan between wars as notInWar, cached like a war", async () => {
    const { result, life } = await endpoints.currentWar(request, "#28PP");
    expect(result).toMatchObject({ ok: false, error: { kind: "notInWar" } });
    expect(life).toBe("war");
  });

  it("reports a missing CWL group (404) as cwlNotActive, cached like a war", async () => {
    const { result, life } = await endpoints.leagueGroup(request, "#28PP");
    expect(result).toMatchObject({ ok: false, error: { kind: "cwlNotActive", status: 404 } });
    expect(life).toBe("war");
  });

  it("keeps other league group errors", async () => {
    const { result, life } = await endpoints.leagueGroup(request, "#999PP");
    expect(result).toMatchObject({ ok: false, error: { kind: "maintenance" } });
    expect(life).toBe("apiError");
  });
});

describe("endpoints: paths and shaping", () => {
  it("encodes the normalised tag", async () => {
    const { req, paths } = spy();
    await endpoints.warLog(req, " 2prgp0l22 ");
    expect(paths).toEqual(["/clans/%232PRGP0L22/warlog?limit=10000"]);
  });

  it("sorts the battle log newest first", async () => {
    const { result } = await endpoints.battleLog(request, "#2PP");
    if (!result.ok) throw new Error("expected data");
    const times = result.data.map((b) => b.battleTimestamp);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("takes the Legend snapshot's trophies and battles from one call each", async () => {
    const req = vi.fn(request) as unknown as Requester;
    const { result, life } = await endpoints.legendSnapshot(req, "#2PP");
    expect(result.ok).toBe(true);
    expect(life).toBe("war");
    expect(vi.mocked(req).mock.calls.map((c) => c[0])).toEqual(["/players/%232PP", "/players/%232PP/battlelog"]);
  });

  it("fails the Legend snapshot when either half fails", async () => {
    const { result, life } = await endpoints.legendSnapshot(request, "#888PP");
    expect(result).toMatchObject({ ok: false, error: { kind: "notFound" } });
    expect(life).toBe("apiError");
  });
});
