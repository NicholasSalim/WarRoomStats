// A player's current ranked season: picks Legend I (day by day, rebuilt from
// the battle log) or a weekly tournament (from the league group's logs),
// fetches what that mode needs and composes it. Pure: the fetchers are passed
// in, so the branching is tested with fixtures.

import type { ApiError, ApiResult } from "./errors";
import type { BattleLogEntry, LeagueSeasonResult, Player, RankedGroup } from "./schemas";
import { attachArmies, legendSeason, legendSeasonWindow, weeklySeason, type RankedSeason } from "./season";
import { rankedAllowance, type RankedAllowance } from "./stats";

/** The player's weekly tournament group, when they're in one. */
export interface RankedGroupRef {
  groupTag: string;
  seasonId: number;
}

/** "#0" (or nothing) means the player isn't in a group, e.g. Legend I or unranked. */
export function rankedGroupRef(player: Pick<Player, "currentLeagueGroupTag" | "currentLeagueSeasonId">): RankedGroupRef | null {
  const { currentLeagueGroupTag: groupTag, currentLeagueSeasonId: seasonId } = player;
  return groupTag && groupTag !== "#0" && seasonId ? { groupTag, seasonId } : null;
}

type RankedPlayer = Pick<Player, "leagueTier" | "currentLeagueGroupTag" | "currentLeagueSeasonId">;

/**
 * How the player's current season works: Legend I is played day by day with
 * no group; every other ranked tier is a weekly tournament in a group (which
 * may not be drawn yet).
 */
export type RankedMode =
  | { kind: "unranked" }
  | { kind: "legend"; allowance: RankedAllowance }
  | { kind: "weekly"; allowance: RankedAllowance; group: RankedGroupRef | null };

export function rankedMode(player: RankedPlayer): RankedMode {
  const allowance = rankedAllowance(player.leagueTier?.id);
  if (!allowance) return { kind: "unranked" };
  if (allowance.period === "day") return { kind: "legend", allowance };
  return { kind: "weekly", allowance, group: rankedGroupRef(player) };
}

export interface RankedSeasonFetchers {
  legendSnapshot(tag: string): Promise<ApiResult<{ trophies: number | null; battles: BattleLogEntry[] }>>;
  leagueHistory(tag: string): Promise<ApiResult<LeagueSeasonResult[]>>;
  rankedGroup(groupTag: string, seasonId: number, playerTag: string): Promise<ApiResult<RankedGroup>>;
  battleLog(tag: string): Promise<ApiResult<BattleLogEntry[]>>;
}

export type RankedSeasonResult =
  | { kind: "season"; allowance: RankedAllowance; season: RankedSeason }
  | { kind: "error"; allowance: RankedAllowance; error: ApiError }
  /** Ranked, but not drawn into this week's tournament group yet. */
  | { kind: "notInGroup"; allowance: RankedAllowance }
  | { kind: "unranked" };

export async function buildRankedSeason(
  player: RankedPlayer & Pick<Player, "tag">,
  nowMs: number,
  fetch: RankedSeasonFetchers,
): Promise<RankedSeasonResult> {
  const mode = rankedMode(player);
  if (mode.kind === "unranked") return mode;
  const { allowance } = mode;

  if (mode.kind === "legend") {
    // Trophies and battles from the same moment (see getLegendSnapshot).
    const [snap, history] = await Promise.all([fetch.legendSnapshot(player.tag), fetch.leagueHistory(player.tag)]);
    if (!snap.ok) return { kind: "error", allowance, error: snap.error };
    // Without history the window falls back to the current month's estimate.
    const window = legendSeasonWindow(history.ok ? history.data : [], nowMs);
    return { kind: "season", allowance, season: legendSeason(snap.data.battles, snap.data.trophies, window, nowMs) };
  }

  const ref = mode.group;
  if (!ref) return { kind: "notInGroup", allowance };
  const [group, log] = await Promise.all([
    fetch.rankedGroup(ref.groupTag, ref.seasonId, player.tag),
    fetch.battleLog(player.tag),
  ]);
  if (!group.ok) return { kind: "error", allowance, error: group.error };
  const season = weeklySeason(group.data.attackLogs, group.data.defenseLogs, ref.seasonId, nowMs);
  // Armies only exist in the battle log; match recent battles to it. Optional.
  return { kind: "season", allowance, season: log.ok ? attachArmies(season, log.data) : season };
}
