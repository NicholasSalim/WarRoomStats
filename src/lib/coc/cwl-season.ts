// A clan's current Clan War League season: its group, every war of every
// started round, and the clan's own war per round. Pure: the war fetcher is
// passed in, so the whole assembly is tested with fixtures.

import type { ApiResult } from "./errors";
import type { LeagueGroup, War } from "./schemas";
import { warForClan, type CwlRound } from "./stats";

export interface CwlSeason {
  /** The clan the season is seen from (normalised tag). */
  clanTag: string;
  group: LeagueGroup;
  /** Every fetched war of every round; unstarted rounds are empty. Feeds the group standings. */
  rounds: CwlRound[];
  /** The clan's own war per round, from its point of view; null until the round starts. */
  ourWars: { round: number; war: War | null }[];
  /**
   * Round wars that failed to load. They're left out rather than failing the
   * whole season, so standings and player stats are partial when this is > 0.
   */
  missingWars: number;
}

/** Placeholder the API uses for wars of rounds that haven't been drawn yet. */
const NO_WAR = "#0";

export async function buildCwlSeason(
  clanTag: string,
  group: LeagueGroup,
  getWar: (warTag: string) => Promise<ApiResult<War>>,
): Promise<CwlSeason> {
  let missingWars = 0;
  const rounds: CwlRound[] = await Promise.all(
    group.rounds.map(async (r, i) => {
      const tags = r.warTags.filter((t) => t && t !== NO_WAR);
      const results = await Promise.all(tags.map(getWar));
      const wars = results.flatMap((res) => (res.ok ? [res.data] : []));
      missingWars += results.length - wars.length;
      return { round: i + 1, wars };
    }),
  );
  const ourWars = rounds.map((r) => ({ round: r.round, war: warForClan(r.wars, clanTag) }));
  return { clanTag, group, rounds, ourWars, missingWars };
}

/**
 * The round `war` (a clan's current war) belongs to, or null when it's a
 * regular war. During CWL the current-war endpoint can return a round's war.
 */
export function roundOf(war: Pick<War, "startTime" | "opponent">, season: CwlSeason): number | null {
  const match = season.ourWars.find(
    ({ war: w }) => w !== null && w.startTime === war.startTime && w.opponent?.tag === war.opponent?.tag,
  );
  return match?.round ?? null;
}
