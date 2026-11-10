import { describe, expect, it } from "vitest";
import currentWarJson from "./fixtures/currentwar.json";
import cwlWarsJson from "./fixtures/cwl-wars.json";
import leagueGroupJson from "./fixtures/leaguegroup.json";
import playerJson from "./fixtures/player.json";
import warLogJson from "./fixtures/warlog.json";
import battleLogJson from "./fixtures/battlelog.json";
import {
  BattleLogSchema,
  LeagueGroupSchema,
  PlayerSchema,
  WarLogSchema,
  WarSchema,
  type BattleLogEntry,
  type RankedLogEntry,
  type War,
} from "./schemas";
import {
  legendTrophies,
  rankedAllowance,
  rankedTrophiesForBattles,
  summarizeBattleLog,
  cwlPlayerStats,
  cwlStandings,
  donationRatio,
  newStarsByAttack,
  parseApiTime,
  summarizeWarLog,
  unitProgress,
  warForClan,
  warMemberRows,
  warOutcome,
  warSideSummary,
  type CwlRound,
} from "./stats";

const war = WarSchema.parse(currentWarJson);
const warLog = WarLogSchema.parse(warLogJson);
const group = LeagueGroupSchema.parse(leagueGroupJson);
const cwlWars = Object.fromEntries(Object.entries(cwlWarsJson).map(([k, v]) => [k, WarSchema.parse(v)]));
const rounds: CwlRound[] = group.rounds.map((r, i) => ({
  round: i + 1,
  wars: r.warTags.filter((t) => t !== "#0").map((t) => cwlWars[t]),
}));
const CLAN = "#2PRGP0L22";

function makeWar(partial: Partial<War>): War {
  return { state: "warEnded", teamSize: 1, attacksPerMember: 2, ...partial };
}

describe("parseApiTime", () => {
  it("parses the API's compact format", () => {
    expect(parseApiTime("20261107T120000.000Z")?.toISOString()).toBe("2026-11-07T12:00:00.000Z");
  });
  it("returns null for garbage", () => {
    expect(parseApiTime("2026-11-07")).toBeNull();
    expect(parseApiTime(undefined)).toBeNull();
  });
});

describe("warOutcome", () => {
  it("compares stars, then destruction", () => {
    expect(warOutcome({ stars: 30 }, { stars: 29 })).toBe("win");
    expect(warOutcome({ stars: 30, destructionPercentage: 90 }, { stars: 30, destructionPercentage: 91 })).toBe("lose");
    expect(warOutcome({ stars: 30, destructionPercentage: 90 }, { stars: 30, destructionPercentage: 90 })).toBe("tie");
  });
});

describe("current war rows", () => {
  it("totals each member's stars to the clan's attack count", () => {
    const rows = warMemberRows(war, "clan");
    expect(rows).toHaveLength(15);
    expect(rows.map((r) => r.mapPosition)).toEqual([...rows.map((r) => r.mapPosition)].sort((a, b) => a - b));
    expect(rows.reduce((s, r) => s + r.attacksUsed, 0)).toBe(war.clan?.attacks);
  });

  it("new stars across the side equal the clan's war stars", () => {
    const rows = warMemberRows(war, "clan");
    expect(rows.reduce((s, r) => s + r.newStars, 0)).toBe(war.clan?.stars);
  });

  it("only counts stars that improve on earlier attacks", () => {
    const w = makeWar({
      clan: {
        members: [
          { tag: "#A", name: "a", townhallLevel: 16, mapPosition: 1, attacks: [{ attackerTag: "#A", defenderTag: "#X", stars: 2, destructionPercentage: 80, order: 1 }] },
          { tag: "#B", name: "b", townhallLevel: 16, mapPosition: 2, attacks: [{ attackerTag: "#B", defenderTag: "#X", stars: 3, destructionPercentage: 100, order: 2 }] },
        ],
      },
      opponent: { members: [] },
    });
    const fresh = newStarsByAttack(w);
    expect(fresh.get("#A|1")).toBe(2);
    expect(fresh.get("#B|2")).toBe(1);
  });

  it("summarises the star spread", () => {
    const s = warSideSummary(war, "clan");
    expect(s.starSpread.reduce((a, b) => a + b, 0)).toBe(s.attacksUsed);
    expect(s.attacksAllowed).toBe(30);
  });
});

describe("summarizeWarLog", () => {
  it("skips CWL entries and counts results", () => {
    const s = summarizeWarLog(warLog.items);
    expect(s.wars).toBe(warLog.items.length - 1);
    expect(s.wins + s.losses + s.ties).toBe(s.wars);
    expect(s.winRate).toBeGreaterThanOrEqual(0);
    expect(s.winRate).toBeLessThanOrEqual(1);
  });

  it("handles an empty log", () => {
    expect(summarizeWarLog([])).toMatchObject({ wars: 0, winRate: 0, avgStarsPerWar: 0 });
  });
});

describe("CWL", () => {
  it("ranks all eight clans by stars plus win bonus", () => {
    const table = cwlStandings(group, rounds);
    expect(table).toHaveLength(8);
    for (const row of table) expect(row.points).toBe(row.stars + row.wins * 10);
    for (let i = 1; i < table.length; i++) expect(table[i - 1].points).toBeGreaterThanOrEqual(table[i].points);
  });

  it("only counts ended wars as played", () => {
    const table = cwlStandings(group, rounds);
    // Rounds 1-2 ended, round 3 is live: every clan has played exactly 2.
    for (const row of table) expect(row.played).toBe(2);
  });

  it("orients a war so our clan is on the clan side", () => {
    const started = rounds.filter((r) => r.wars.length > 0);
    expect(started).toHaveLength(3);
    for (const r of started) {
      const w = warForClan(r.wars, CLAN);
      expect(w?.clan?.tag).toBe(CLAN);
    }
    expect(warForClan([], CLAN)).toBeNull();
  });

  it("aggregates per-player stats across rounds", () => {
    const rows = cwlPlayerStats(CLAN, rounds);
    expect(rows.length).toBeGreaterThan(0);
    const totalStars = rows.reduce((s, r) => s + r.stars, 0);
    const fromWars = rounds.flatMap((r) => warForClan(r.wars, CLAN)?.clan?.members ?? []).flatMap((m) => m.attacks ?? []);
    expect(totalStars).toBe(fromWars.reduce((s, a) => s + a.stars, 0));
    for (const r of rows) expect(r.warsIn).toBeLessThanOrEqual(3);
  });
});

describe("ranked allowance", () => {
  const tier = (n: number) => 105_000_000 + n;
  it("gives Legend I 8 attacks and 8 defenses per day", () => {
    expect(rankedAllowance(tier(36))).toEqual({ period: "day", attacks: 8, defenses: 8 });
  });
  it("gives weekly tiers their attack count", () => {
    expect(rankedAllowance(tier(35))).toMatchObject({ period: "week", attacks: 30 });
    expect(rankedAllowance(tier(34))?.attacks).toBe(24);
    expect(rankedAllowance(tier(33))?.attacks).toBe(24);
    expect(rankedAllowance(tier(28))?.attacks).toBe(18);
    expect(rankedAllowance(tier(26))?.attacks).toBe(14);
    expect(rankedAllowance(tier(22))?.attacks).toBe(12);
    expect(rankedAllowance(tier(18))?.attacks).toBe(10);
    expect(rankedAllowance(tier(7))?.attacks).toBe(8);
    expect(rankedAllowance(tier(1))?.attacks).toBe(6);
  });
  it("has none for unranked or unknown", () => {
    expect(rankedAllowance(tier(0))).toBeNull();
    expect(rankedAllowance(undefined)).toBeNull();
  });
});

describe("legendTrophies", () => {
  it("follows the Legend League table", () => {
    expect(legendTrophies(3, 100)).toBe(40);
    // 2 stars: values tracked by clashspot for the same battles
    expect([73, 81, 85, 87, 90, 91, 92, 97].map((p) => legendTrophies(2, p))).toEqual([23, 26, 27, 28, 29, 29, 30, 31]);
    expect(legendTrophies(2, 50)).toBe(16);
    expect(legendTrophies(2, 99)).toBe(32);
    expect(legendTrophies(1, 1)).toBe(5);
    expect(legendTrophies(1, 99)).toBe(15);
    expect(legendTrophies(0, 60)).toBe(0);
  });
});

describe("rankedTrophiesForBattles", () => {
  const battle = (over: Partial<BattleLogEntry>): BattleLogEntry => ({
    battleType: "ranked",
    attack: true,
    opponentPlayerTag: "#A",
    opponentName: "a",
    stars: 2,
    destructionPercentage: 80,
    battleTimestamp: "20261103T100000.000Z",
    ...over,
  });
  const log = (over: Partial<RankedLogEntry>): RankedLogEntry => ({
    opponentPlayerTag: "#A",
    opponentName: "a",
    stars: 2,
    destructionPercentage: 80,
    trophies: 25,
    creationTime: "2026-11-03T10:02:30Z",
    ...over,
  });

  it("returns the trophies earned on attack and on defense", () => {
    const out = rankedTrophiesForBattles(
      [battle({}), battle({ attack: false, opponentPlayerTag: "#B" })],
      [log({})],
      [log({ opponentPlayerTag: "#B", trophies: 19 })],
    );
    expect(out).toEqual([25, 19]);
  });

  it("does not match a different result, an old battle, or a regular battle", () => {
    expect(rankedTrophiesForBattles([battle({ stars: 3 })], [log({})], [])).toEqual([null]);
    expect(rankedTrophiesForBattles([battle({})], [log({ creationTime: "2026-11-03T11:00:00Z" })], [])).toEqual([null]);
    expect(rankedTrophiesForBattles([battle({ battleType: "homeVillage", opponentPlayerTag: "#Z" })], [log({})], [])).toEqual([null]);
  });

  it("uses each group log entry once (rematch against the same opponent)", () => {
    const out = rankedTrophiesForBattles(
      [battle({ battleTimestamp: "20261103T100000.000Z" }), battle({ battleTimestamp: "20261103T100500.000Z" })],
      [log({ creationTime: "2026-11-03T10:00:30Z", trophies: 10 }), log({ creationTime: "2026-11-03T10:05:30Z", trophies: 12 })],
      [],
    );
    expect(out).toEqual([10, 12]);
  });
});

describe("battle log summary", () => {
  it("separates attacks and defenses", () => {
    const log = BattleLogSchema.parse(battleLogJson).items;
    const s = summarizeBattleLog(log);
    expect(s.attacks + s.defenses).toBe(log.length);
    expect(s.avgAttackStars).toBeGreaterThanOrEqual(0);
    expect(s.avgAttackStars).toBeLessThanOrEqual(3);
    expect(summarizeBattleLog([])).toMatchObject({ attacks: 0, defenses: 0, avgAttackStars: 0 });
  });
});

describe("players", () => {
  const player = PlayerSchema.parse(playerJson);

  it("computes donation ratio edge cases", () => {
    expect(donationRatio(100, 50)).toBe(2);
    expect(donationRatio(0, 0)).toBeNull();
    expect(donationRatio(10, 0)).toBe(Infinity);
  });

  it("computes unit progress", () => {
    const p = unitProgress(player.heroes);
    expect(p.ratio).toBeGreaterThan(0);
    expect(p.ratio).toBeLessThanOrEqual(1);
    expect(p.count).toBe(player.heroes.length);
    expect(unitProgress([])).toMatchObject({ ratio: 0, count: 0 });
  });
});
