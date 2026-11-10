import { describe, expect, it, vi } from "vitest";
import { endpoints, type Requester } from "./endpoints";
import type { ApiResult } from "./errors";
import { fixtureFetch } from "./fixtures";
import { buildRankedSeason, rankedGroupRef, rankedMode, type RankedSeasonFetchers } from "./ranked-season";
import type { RankedGroup } from "./schemas";
import { cocRequest } from "./transport";

const request: Requester = (path, schema) =>
  cocRequest({ baseUrl: "mock://coc", token: "t", fetchImpl: fixtureFetch }, path, schema);

function fetchers(): RankedSeasonFetchers {
  return {
    legendSnapshot: vi.fn(async (tag: string) => (await endpoints.legendSnapshot(request, tag)).result),
    leagueHistory: vi.fn(async (tag: string) => (await endpoints.leagueHistory(request, tag)).result),
    rankedGroup: vi.fn(async (g: string, s: number, p: string) => (await endpoints.rankedGroup(request, g, s, p)).result),
    battleLog: vi.fn(async (tag: string) => (await endpoints.battleLog(request, tag)).result),
  };
}

const NOW = Date.UTC(2026, 10, 10, 12);
const tier = (id: number) => ({ id, name: "tier" });
const weekly = { tag: "#2PP", leagueTier: tier(105000026), currentLeagueGroupTag: "#2QYLPR9", currentLeagueSeasonId: 1793595600 };
const legend = { tag: "#2PP", leagueTier: tier(105000036), currentLeagueGroupTag: "#0" };

describe("rankedGroupRef", () => {
  it.each([
    [{ currentLeagueGroupTag: "#2QYLPR9", currentLeagueSeasonId: 5 }, { groupTag: "#2QYLPR9", seasonId: 5 }],
    [{ currentLeagueGroupTag: "#0", currentLeagueSeasonId: 5 }, null],
    [{ currentLeagueGroupTag: "#2QYLPR9" }, null],
    [{}, null],
  ])("%o", (player, expected) => {
    expect(rankedGroupRef(player)).toEqual(expected);
  });
});

describe("buildRankedSeason", () => {
  it("is unranked without a ranked tier, and fetches nothing", async () => {
    const f = fetchers();
    expect(await buildRankedSeason({ tag: "#2PP" }, NOW, f)).toEqual({ kind: "unranked" });
    expect(f.legendSnapshot).not.toHaveBeenCalled();
    expect(f.rankedGroup).not.toHaveBeenCalled();
  });

  it("builds Legend I day by day from the snapshot, without the group", async () => {
    const f = fetchers();
    const r = await buildRankedSeason(legend, NOW, f);
    expect(r).toMatchObject({ kind: "season", allowance: { period: "day" }, season: { kind: "legend" } });
    expect(f.rankedGroup).not.toHaveBeenCalled();
  });

  it("builds a weekly season from the group's logs", async () => {
    const f = fetchers();
    const r = await buildRankedSeason(weekly, NOW, f);
    expect(r).toMatchObject({ kind: "season", allowance: { period: "week" }, season: { kind: "weekly" } });
    expect(f.rankedGroup).toHaveBeenCalledWith("#2QYLPR9", 1793595600, "#2PP");
    expect(f.legendSnapshot).not.toHaveBeenCalled();
  });

  it("is notInGroup for a weekly tier before the group is drawn", async () => {
    const f = fetchers();
    const r = await buildRankedSeason({ ...weekly, currentLeagueGroupTag: "#0" }, NOW, f);
    expect(r).toMatchObject({ kind: "notInGroup", allowance: { period: "week" } });
  });

  it("reports the group's error", async () => {
    const f = fetchers();
    f.rankedGroup = async (): Promise<ApiResult<RankedGroup>> => ({ ok: false, error: { kind: "maintenance", status: 503 } });
    expect(await buildRankedSeason(weekly, NOW, f)).toMatchObject({ kind: "error", error: { kind: "maintenance" } });
  });

  it("still shows the weekly season when the battle log fails", async () => {
    const f = fetchers();
    f.battleLog = async () => ({ ok: false, error: { kind: "unavailable", status: 500 } });
    expect(await buildRankedSeason(weekly, NOW, f)).toMatchObject({ kind: "season" });
  });
});

describe("rankedMode", () => {
  it("tells Legend I, weekly (with or without a group) and unranked apart", () => {
    expect(rankedMode(legend)).toMatchObject({ kind: "legend", allowance: { period: "day", attacks: 8 } });
    expect(rankedMode(weekly)).toMatchObject({ kind: "weekly", group: { groupTag: "#2QYLPR9", seasonId: 1793595600 } });
    expect(rankedMode({ ...weekly, currentLeagueGroupTag: "#0" })).toMatchObject({ kind: "weekly", group: null });
    expect(rankedMode({})).toEqual({ kind: "unranked" });
  });
});
