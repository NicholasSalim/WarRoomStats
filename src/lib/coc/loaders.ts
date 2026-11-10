import "server-only";

// Loaders that combine several cached client calls into one domain object.
// The assembly logic lives in pure modules (cwl-season.ts, ranked-season.ts)
// that take their fetchers as arguments; these bind them to the real client.

import { getBattleLog, getCwlWar, getLeagueGroup, getLeagueHistory, getLegendSnapshot, getRankedGroup } from "./client";
import { buildCwlSeason, type CwlSeason } from "./cwl-season";
import { INVALID_TAG } from "./endpoints";
import type { ApiResult } from "./errors";
import { buildRankedSeason, rankedMode, type RankedSeasonResult } from "./ranked-season";
import type { Player, RankedGroup } from "./schemas";
import { normalizeTag } from "./tag";

/** The clan's current CWL season with every round's wars. Errors are the league group's. */
export async function loadCwlSeason(rawTag: string): Promise<ApiResult<CwlSeason>> {
  const tag = normalizeTag(rawTag);
  if (!tag) return { ok: false, error: INVALID_TAG };
  const group = await getLeagueGroup(tag);
  if (!group.ok) return group;
  return { ok: true, data: await buildCwlSeason(tag, group.data, getCwlWar) };
}

/** The player's current ranked season (Legend I or weekly), ready to render. */
export function loadRankedSeason(player: Player, nowMs: number): Promise<RankedSeasonResult> {
  return buildRankedSeason(player, nowMs, {
    legendSnapshot: getLegendSnapshot,
    leagueHistory: getLeagueHistory,
    rankedGroup: getRankedGroup,
    battleLog: getBattleLog,
  });
}

/** The player's weekly tournament group, or null when they aren't in one. */
export function loadRankedGroup(player: Player): Promise<ApiResult<RankedGroup>> | null {
  const mode = rankedMode(player);
  if (mode.kind !== "weekly" || !mode.group) return null;
  return getRankedGroup(mode.group.groupTag, mode.group.seasonId, player.tag);
}
