import { describe, expect, it } from "vitest";
import type { BattleLogEntry, LeagueSeasonResult, RankedLogEntry } from "./schemas";
import { attachArmies, legendSeason, legendSeasonWindow, summarizeBattles, weeklySeason } from "./season";

const H = 3_600_000;
const SEASON_START = Date.UTC(2026, 10, 2, 5); // Mon 2 Nov 05:00 UTC
const ts = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, ".000Z");

let n = 0;
const battle = (dayStart: number, attack: boolean, stars: number, pct: number): BattleLogEntry => ({
  battleType: "legend",
  attack,
  opponentPlayerTag: "#P",
  opponentName: "p",
  stars,
  destructionPercentage: pct,
  battleTimestamp: ts(dayStart + 2 * H + n++ * 60_000),
});

describe("legendSeasonWindow", () => {
  const result = (endIso: string): LeagueSeasonResult => ({ leagueSeasonId: Date.parse(endIso) / 1000, leagueTierId: 105_000_036 }) as LeagueSeasonResult;
  it("starts where the last finished Legend I season ended", () => {
    const now = Date.UTC(2026, 10, 8, 12);
    const w = legendSeasonWindow([result("2026-10-05T05:00:00Z"), result("2026-11-02T05:00:00Z")], now);
    expect(new Date(w.startMs).toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(new Date(w.endMs).toISOString()).toBe("2026-11-30T05:00:00.000Z");
  });
  it("falls back to the 28-day cycle without history", () => {
    const w = legendSeasonWindow([], Date.UTC(2026, 11, 3));
    expect(new Date(w.startMs).toISOString()).toBe("2026-11-30T05:00:00.000Z");
  });
});

describe("legendSeason", () => {
  // Days 6-7 of a real player (#L2LJ9QLU), as tracked by clashspot:
  // day 6 starts at 5,223 and ends at 5,147; day 7 ends at 5,245 (now).
  const day6 = SEASON_START + 5 * 24 * H;
  const day7 = SEASON_START + 6 * 24 * H;
  const entries: BattleLogEntry[] = [
    { ...battle(day6 - 100 * H, true, 3, 100), battleType: "homeVillage" }, // older regular battle: ignored for coverage
    battle(day6 - 4 * H, false, 0, 30), // oldest Legend battle, late on day 5 (0 stars: no trophy change)
    ...[[1, 81], [2, 81], [3, 100], [2, 92], [3, 100], [2, 87], [3, 100], [2, 85]].map(([s, p]) => battle(day6, true, s, p)),
    ...Array.from({ length: 8 }, () => battle(day6, false, 3, 100)),
    ...[[2, 87], [2, 90], [3, 100], [2, 92], [3, 100]].map(([s, p]) => battle(day7, true, s, p)),
    battle(day7, false, 3, 100),
    battle(day7, false, 2, 91),
  ];
  const now = day7 + 10 * H;
  const season = legendSeason(entries, 5245, { startMs: SEASON_START, endMs: SEASON_START + 28 * 24 * H }, now);

  it("lists every day from day 1 to today", () => {
    expect(season.days.map((d) => d.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(season.days.at(-1)?.isToday).toBe(true);
  });

  it("rebuilds the tracked day start and end trophies", () => {
    const [d6, d7] = season.days.slice(5);
    expect(d6).toMatchObject({ coverage: "complete", trophiesStart: 5223, trophiesEnd: 5147 });
    expect(d7).toMatchObject({ coverage: "complete", trophiesStart: 5147, trophiesEnd: 5245 });
    expect(d6.attacks).toHaveLength(8);
    expect(d6.defenses).toHaveLength(8);
  });

  it("marks days older than the battle log", () => {
    expect(season.days[4]).toMatchObject({ coverage: "partial", trophiesStart: null, trophiesEnd: 5223 });
    // Day 2 has a regular battle but no Legend battles: still missing.
    for (const d of season.days.slice(0, 4)) expect(d).toMatchObject({ coverage: "missing", trophiesStart: null, trophiesEnd: null });
  });
});

describe("weeklySeason", () => {
  const log = (iso: string, trophies: number, stars = 2): RankedLogEntry => ({
    opponentPlayerTag: "#P",
    opponentName: "p",
    stars,
    destructionPercentage: 80,
    trophies,
    creationTime: iso,
  });
  it("adds attack and defense trophies from 0, day by day", () => {
    const s = weeklySeason(
      [log("2026-11-02T06:00:00Z", 30), log("2026-11-03T06:00:00Z", 40, 3), log("2026-11-09T06:00:00Z", 99)],
      [log("2026-11-02T08:00:00Z", 12)],
      SEASON_START / 1000,
      Date.UTC(2026, 10, 3, 12),
    );
    expect(s.days.map((d) => [d.trophiesStart, d.trophiesEnd])).toEqual([
      [0, 42],
      [42, 82],
    ]);
    expect(summarizeBattles(s.days.flatMap((d) => d.attacks))).toMatchObject({ count: 2, trophies: 70, spread: [1, 1, 0, 0] });
  });
});

describe("attachArmies", () => {
  it("copies the army from the matching battle log entry", () => {
    const s = weeklySeason(
      [{ opponentPlayerTag: "#P", opponentName: "p", stars: 2, destructionPercentage: 80, trophies: 30, creationTime: "2026-11-02T06:01:00Z" }],
      [],
      SEASON_START / 1000,
      Date.UTC(2026, 10, 2, 12),
    );
    const log: BattleLogEntry[] = [
      { battleType: "ranked", attack: true, opponentPlayerTag: "#P", opponentName: "p", stars: 2, destructionPercentage: 80, battleTimestamp: "20261102T060000.000Z", armyShareCode: "u10x0", opponentTownHallLevel: 17 },
      { battleType: "ranked", attack: true, opponentPlayerTag: "#P", opponentName: "p", stars: 3, destructionPercentage: 100, battleTimestamp: "20261102T060000.000Z", armyShareCode: "u5x1" },
    ];
    const [a] = attachArmies(s, log).days[0].attacks;
    expect(a).toMatchObject({ armyCode: "u10x0", opponentTownHall: 17 });
  });
});
