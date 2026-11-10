import { describe, expect, it } from "vitest";
import { buildCwlSeason, roundOf } from "./cwl-season";
import { endpoints, type Requester } from "./endpoints";
import type { ApiResult } from "./errors";
import { fixtureFetch } from "./fixtures";
import leagueGroupJson from "./fixtures/leaguegroup.json";
import { LeagueGroupSchema, type War } from "./schemas";
import { cocRequest } from "./transport";

const request: Requester = (path, schema) =>
  cocRequest({ baseUrl: "mock://coc", token: "t", fetchImpl: fixtureFetch }, path, schema);
const getWar = async (tag: string) => (await endpoints.cwlWar(request, tag)).result;
const group = LeagueGroupSchema.parse(leagueGroupJson);
const CLAN = "#2PRGP0L22";

describe("buildCwlSeason", () => {
  it("fetches every drawn war and finds the clan's war per round", async () => {
    const asked: string[] = [];
    const season = await buildCwlSeason(CLAN, group, (tag) => {
      asked.push(tag);
      return getWar(tag);
    });
    expect(asked).not.toContain("#0");
    expect(asked).toHaveLength(12); // 3 drawn rounds of 4 wars
    expect(season.rounds).toHaveLength(7);
    expect(season.missingWars).toBe(0);
    const started = season.ourWars.filter((w) => w.war);
    expect(started.map((w) => w.round)).toEqual([1, 2, 3]);
    // Each war is turned to the clan's point of view.
    for (const { war } of started) expect(war?.clan?.tag).toBe(CLAN);
    expect(season.ourWars.slice(3).every((w) => w.war === null)).toBe(true);
  });

  it("leaves out wars that fail to load and counts them", async () => {
    let n = 0;
    const flaky = async (tag: string): Promise<ApiResult<War>> =>
      ++n % 4 === 0 ? { ok: false, error: { kind: "unavailable", status: 500 } } : getWar(tag);
    const season = await buildCwlSeason(CLAN, group, flaky);
    expect(season.missingWars).toBe(3);
    expect(season.rounds.reduce((sum, r) => sum + r.wars.length, 0)).toBe(9);
  });
});

describe("roundOf", () => {
  it("matches the current war to a round by start time and opponent", async () => {
    const season = await buildCwlSeason(CLAN, group, getWar);
    const war = season.ourWars[1].war!;
    expect(roundOf(war, season)).toBe(2);
    expect(roundOf({ ...war, startTime: "20000101T000000.000Z" }, season)).toBeNull();
    expect(roundOf({ ...war, opponent: { ...war.opponent, tag: "#PPPP" } }, season)).toBeNull();
  });
});
