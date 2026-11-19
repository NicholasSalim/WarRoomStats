// Current ranked season, day by day (the player's season page). Pure functions
// over live API data; no I/O.
//
// - Legend I: a 4-week season (28 league days, 05:00 to 05:00 UTC, 8 attacks +
//   8 defenses each). The API has no group logs for Legend I, so battles come
//   from the battle log (last ~40-50 battles) and trophies are estimated with
//   legendTrophies(). Day start/end trophies are rebuilt backwards from the
//   player's current trophies, so they're only known inside the battle log.
// - Weekly tiers: a 7-day tournament from the group logs, with exact trophies.
//   League trophies start at 0 and both attacks and defenses add to them.

import type { BattleLogEntry, LeagueSeasonResult, RankedLogEntry } from "./schemas";
import { legendTrophies, parseApiTime } from "./stats";

export const DAY_MS = 86_400_000;
const LEGEND_I = 105_000_036;
export const LEGEND_SEASON_DAYS = 28;
/** A Legend I season ended here (from live league history); seasons repeat every 28 days. */
const LEGEND_ANCHOR_MS = Date.UTC(2026, 10, 2, 5);

export interface SeasonBattle {
  attack: boolean;
  opponentTag: string;
  opponentName: string;
  stars: number;
  destruction: number;
  /** The player's trophy change from this battle. */
  trophies: number;
  whenMs: number;
  /** Army share code from the battle log; null when the battle isn't in it. */
  armyCode: string | null;
  opponentTownHall: number | null;
}

/**
 * - complete: every battle of the day is here
 * - partial: the oldest Legend battle in the log is from this day, so earlier
 *   battles of the day may be missing
 * - missing: the day is older than every Legend battle in the log
 */
export type DayCoverage = "complete" | "partial" | "missing";

export interface SeasonDay {
  /** 1-based day of the season. */
  number: number;
  startMs: number;
  endMs: number;
  attacks: SeasonBattle[];
  defenses: SeasonBattle[];
  coverage: DayCoverage;
  /** League trophies at the start / end (or now, for today) of the day; null when unknown. */
  trophiesStart: number | null;
  trophiesEnd: number | null;
  isToday: boolean;
}

export interface RankedSeason {
  kind: "legend" | "weekly";
  startMs: number;
  endMs: number;
  /** Days from day 1 up to today, oldest first. */
  days: SeasonDay[];
  /** True when trophy values are estimates (Legend I). */
  estimated: boolean;
}

/**
 * The current Legend I season window. Prefers the player's own history (the
 * last finished Legend I season's end is the current season's start) and
 * falls back to the global 28-day cycle.
 */
export function legendSeasonWindow(history: LeagueSeasonResult[], nowMs: number): { startMs: number; endMs: number } {
  const ends = history
    .filter((s) => s.leagueTierId === LEGEND_I)
    .map((s) => s.leagueSeasonId * 1000)
    .filter((t) => t <= nowMs && nowMs < t + LEGEND_SEASON_DAYS * DAY_MS);
  const cycle = LEGEND_SEASON_DAYS * DAY_MS;
  const startMs = ends.length ? Math.max(...ends) : LEGEND_ANCHOR_MS + Math.floor((nowMs - LEGEND_ANCHOR_MS) / cycle) * cycle;
  return { startMs, endMs: startMs + cycle };
}

function dayList(startMs: number, endMs: number, nowMs: number) {
  const days: { number: number; startMs: number; endMs: number; isToday: boolean }[] = [];
  for (let t = startMs, n = 1; t < endMs && t <= nowMs; t += DAY_MS, n++) {
    days.push({ number: n, startMs: t, endMs: t + DAY_MS, isToday: nowMs < t + DAY_MS });
  }
  return days;
}

const byTime = (a: SeasonBattle, b: SeasonBattle) => a.whenMs - b.whenMs;

/** Legend I season from the battle log; trophies estimated and rebuilt from `currentTrophies`. */
export function legendSeason(
  entries: BattleLogEntry[],
  currentTrophies: number | null,
  window: { startMs: number; endMs: number },
  nowMs: number,
): RankedSeason {
  // Coverage starts at the oldest Legend battle in the log: live logs held
  // regular battles days older than their oldest Legend battle, so the log's
  // overall start says nothing about which Legend days are complete.
  const legendTimes = entries
    .filter((e) => e.battleType === "legend")
    .map((e) => parseApiTime(e.battleTimestamp)?.getTime())
    .filter((t): t is number => t != null);
  const logStart = legendTimes.length ? Math.min(...legendTimes) : null;

  const battles: SeasonBattle[] = [];
  for (const e of entries) {
    const when = parseApiTime(e.battleTimestamp)?.getTime();
    if (e.battleType !== "legend" || when == null || when < window.startMs || when >= window.endMs) continue;
    const t = legendTrophies(e.stars, e.destructionPercentage);
    battles.push({
      attack: e.attack,
      opponentTag: e.opponentPlayerTag,
      opponentName: e.opponentName,
      stars: e.stars,
      destruction: e.destructionPercentage,
      trophies: e.attack ? t : -t,
      whenMs: when,
      armyCode: e.armyShareCode ?? null,
      opponentTownHall: e.opponentTownHallLevel ?? null,
    });
  }
  battles.sort(byTime);

  // Trophies at time T = now minus every change after T. Valid only from the
  // start of the battle log on (anything earlier may be missing).
  const trophiesAt = (t: number): number | null => {
    if (currentTrophies == null || logStart == null || t < logStart) return null;
    return currentTrophies - battles.filter((b) => b.whenMs > t).reduce((s, b) => s + b.trophies, 0);
  };

  const days = dayList(window.startMs, window.endMs, nowMs).map((d): SeasonDay => {
    const inDay = battles.filter((b) => b.whenMs >= d.startMs && b.whenMs < d.endMs);
    const coverage: DayCoverage = logStart == null || logStart >= d.endMs ? "missing" : logStart > d.startMs ? "partial" : "complete";
    return {
      ...d,
      attacks: inDay.filter((b) => b.attack),
      defenses: inDay.filter((b) => !b.attack),
      coverage,
      trophiesStart: coverage === "complete" ? trophiesAt(d.startMs) : null,
      trophiesEnd: coverage === "missing" ? null : trophiesAt(Math.min(d.endMs, nowMs)),
    };
  });
  return { kind: "legend", startMs: window.startMs, endMs: window.endMs, days, estimated: true };
}

/** Weekly tournament from the group logs; exact trophies, starting at 0. */
export function weeklySeason(
  attackLogs: RankedLogEntry[],
  defenseLogs: RankedLogEntry[],
  seasonId: number,
  nowMs: number,
): RankedSeason {
  const startMs = seasonId * 1000;
  const endMs = startMs + 7 * DAY_MS;
  const toBattle = (attack: boolean) => (e: RankedLogEntry): SeasonBattle => ({
    attack,
    opponentTag: e.opponentPlayerTag,
    opponentName: e.opponentName,
    stars: e.stars,
    destruction: e.destructionPercentage,
    trophies: e.trophies,
    whenMs: Date.parse(e.creationTime),
    armyCode: null,
    opponentTownHall: null,
  });
  const battles = [...attackLogs.map(toBattle(true)), ...defenseLogs.map(toBattle(false))]
    .filter((b) => b.whenMs >= startMs && b.whenMs < endMs)
    .sort(byTime);
  const trophiesAt = (t: number) => battles.filter((b) => b.whenMs <= t).reduce((s, b) => s + b.trophies, 0);

  const days = dayList(startMs, endMs, nowMs).map((d): SeasonDay => {
    const inDay = battles.filter((b) => b.whenMs >= d.startMs && b.whenMs < d.endMs);
    return {
      ...d,
      attacks: inDay.filter((b) => b.attack),
      defenses: inDay.filter((b) => !b.attack),
      coverage: "complete",
      trophiesStart: trophiesAt(d.startMs - 1),
      trophiesEnd: trophiesAt(Math.min(d.endMs, nowMs) - 1),
    };
  });
  return { kind: "weekly", startMs, endMs, days, estimated: false };
}

const MATCH_WINDOW_MS = 10 * 60_000;

/**
 * Fills in army codes (and opponent Town Hall) for weekly-tier battles, which
 * come from the group logs, by matching them to battle log entries: same side,
 * opponent, stars and destruction within 10 minutes, each entry used once.
 * Only battles still in the battle log (the last few days) get an army.
 */
export function attachArmies(season: RankedSeason, entries: BattleLogEntry[]): RankedSeason {
  const used = new Set<BattleLogEntry>();
  const match = (b: SeasonBattle): SeasonBattle => {
    if (b.armyCode) return b;
    let best: BattleLogEntry | null = null;
    let bestGap = Infinity;
    for (const e of entries) {
      if (used.has(e) || e.attack !== b.attack || e.opponentPlayerTag !== b.opponentTag) continue;
      if (e.stars !== b.stars || e.destructionPercentage !== b.destruction) continue;
      const when = parseApiTime(e.battleTimestamp)?.getTime();
      if (when == null) continue;
      const gap = Math.abs(when - b.whenMs);
      if (gap <= MATCH_WINDOW_MS && gap < bestGap) {
        best = e;
        bestGap = gap;
      }
    }
    if (!best) return b;
    used.add(best);
    return { ...b, armyCode: best.armyShareCode ?? null, opponentTownHall: best.opponentTownHallLevel ?? null };
  };
  return { ...season, days: season.days.map((d) => ({ ...d, attacks: d.attacks.map(match), defenses: d.defenses.map(match) })) };
}

export interface StarSummary {
  count: number;
  stars: number;
  avgStars: number;
  /** Battles with 3, 2, 1 and 0 stars. */
  spread: [number, number, number, number];
  trophies: number;
}

/** Totals over the given battles (only what the API still has). */
export function summarizeBattles(battles: SeasonBattle[]): StarSummary {
  const spread: [number, number, number, number] = [0, 0, 0, 0];
  for (const b of battles) spread[3 - Math.max(0, Math.min(3, b.stars))]++;
  const stars = battles.reduce((s, b) => s + b.stars, 0);
  return {
    count: battles.length,
    stars,
    avgStars: battles.length ? stars / battles.length : 0,
    spread,
    trophies: battles.reduce((s, b) => s + b.trophies, 0),
  };
}
