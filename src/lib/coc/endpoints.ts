// Every CoC API endpoint the app reads: its path, input validation, response
// schema, how its errors are reinterpreted and how long a result may be
// cached. Pure (no Next.js APIs), so the whole policy is unit-tested with the
// fixture fetch; client.ts only adds the `use cache` boundary on top.

import type { ZodType } from "zod";
import { apiError, type ApiError, type ApiResult } from "./errors";
import {
  BattleLogSchema,
  BuilderBaseClanRankingsSchema,
  BuilderBasePlayerRankingsSchema,
  CapitalRaidSeasonsSchema,
  CapitalRankingsSchema,
  ClanRankingsSchema,
  ClanSchema,
  ClanSearchSchema,
  GoldPassSeasonSchema,
  LabelsSchema,
  LeagueGroupSchema,
  LeagueHistorySchema,
  LeagueTiersSchema,
  LegendSeasonsSchema,
  LocationsSchema,
  PlayerRankingsSchema,
  PlayerSchema,
  RankedGroupSchema,
  WarLogSchema,
  WarSchema,
  type BattleLogEntry,
  type ClanRanking,
  type PlayerRanking,
} from "./schemas";
import { LEGEND_LEAGUE_ID, LIVE_RANKINGS_LIMIT, PAGE_SIZE, archiveCursor, isLegendSeasonId } from "./rankings";
import { CLAN_SEARCH_LIMIT, toClanSearchItem, type ClanSearchParams } from "./clan-search";
import { normalizeTag } from "./tag";
import { encodeTag } from "./transport";

/** The cacheLife profiles in next.config.ts, plus Next's built-in "max". */
export type CacheProfile = "war" | "profile" | "leaderboard" | "reference" | "apiError" | "max";

/** An endpoint's result and how long the cache may keep it. */
export interface Fetched<T> {
  result: ApiResult<T>;
  life: CacheProfile;
}

/** Sends one GET to the API and validates the body (cocRequest with a config bound). */
export type Requester = <T>(path: string, schema: ZodType<T>) => Promise<ApiResult<T>>;

export interface RankingPage<T> {
  items: T[];
  /** True when the API has another page after this one. */
  hasMore: boolean;
}

/**
 * Every war the game keeps for the clan, newest first. The API returns the
 * whole log in one call when asked for more than it has (60 to 140 wars,
 * back to 2016, about 130 KB; checked live 2026-11-10), with no next page.
 */
const WAR_LOG_LIMIT = 10_000;

/**
 * The game keeps the last 20 raid weekends per clan (checked live
 * 2026-11-10: every clan returned 20, with no next page).
 */
const CAPITAL_RAIDS_LIMIT = 20;

export const INVALID_TAG = apiError("invalidTag", 400);
const BAD_LOCATION = apiError("notFound", 400, "badLocation");
const BAD_SEASON = apiError("notFound", 400, "badSeason");

interface Spec<S, T> {
  /** The request path, or null when the input is invalid. */
  path: string | null;
  schema: ZodType<S>;
  /** Cache lifetime of a successful answer. */
  life: CacheProfile;
  /** The error for invalid input (default: invalidTag). Cached for good. */
  invalid?: ApiError;
  /** Shapes the data; may also turn an answer into an error (e.g. "not in war"). */
  map?: (data: S) => ApiResult<T>;
  /** Reinterprets an upstream error; return undefined to keep it as is. */
  onError?: (error: ApiError) => Fetched<T> | undefined;
}

async function fetchOne<S, T = S>(request: Requester, spec: Spec<S, T>): Promise<Fetched<T>> {
  if (spec.path === null) return { result: { ok: false, error: spec.invalid ?? INVALID_TAG }, life: "max" };
  const res = await request(spec.path, spec.schema);
  if (!res.ok) return spec.onError?.(res.error) ?? { result: res, life: "apiError" };
  return { result: spec.map ? spec.map(res.data) : { ok: true, data: res.data as unknown as T }, life: spec.life };
}

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });

/** Builds a path from a tag, or null when the tag is invalid. */
function byTag(rawTag: string, path: (tag: string) => string): string | null {
  const tag = normalizeTag(rawTag);
  return tag ? path(encodeTag(tag)) : null;
}

/** Builds a rankings path for "global" or a numeric location id, or null. */
function byLocation(location: string, path: (location: string) => string): string | null {
  return location === "global" || /^\d+$/.test(location) ? path(location) : null;
}

/** The API lists battles oldest first; the compact timestamps sort as strings. */
function newestFirst(items: BattleLogEntry[]): BattleLogEntry[] {
  return [...items].sort((a, b) => b.battleTimestamp.localeCompare(a.battleTimestamp));
}

export const endpoints = {
  // ---------- Clans ----------

  clan: (request: Requester, tag: string) =>
    fetchOne(request, { path: byTag(tag, (t) => `/clans/${t}`), schema: ClanSchema, life: "profile" }),

  /** Every clan matching the search (the API stops at 832), trimmed for the result list. */
  clanSearch: (request: Requester, params: ClanSearchParams) => {
    // The API needs a name or at least one other filter; labels alone are enough.
    const query = new URLSearchParams({ limit: String(CLAN_SEARCH_LIMIT) });
    if (params.name) query.set("name", params.name);
    if (params.labelIds?.length) query.set("labelIds", params.labelIds.join(","));
    if (params.warFrequency) query.set("warFrequency", params.warFrequency);
    if (params.locationId) query.set("locationId", String(params.locationId));
    if (params.minMembers) query.set("minMembers", String(params.minMembers));
    if (params.maxMembers) query.set("maxMembers", String(params.maxMembers));
    if (params.minClanLevel) query.set("minClanLevel", String(params.minClanLevel));
    return fetchOne(request, {
      path: `/clans?${query}`,
      schema: ClanSearchSchema,
      life: "profile",
      map: (data) => ok(data.items.map(toClanSearchItem)),
    });
  },

  warLog: (request: Requester, tag: string) =>
    fetchOne(request, {
      path: byTag(tag, (t) => `/clans/${t}/warlog?limit=${WAR_LOG_LIMIT}`),
      schema: WarLogSchema,
      life: "profile",
    }),

  /** "Not in war" comes back as a 200; it's reported as the notInWar error. */
  currentWar: (request: Requester, tag: string) =>
    fetchOne(request, {
      path: byTag(tag, (t) => `/clans/${t}/currentwar`),
      schema: WarSchema,
      life: "war",
      map: (war) => (war.state === "notInWar" ? { ok: false, error: apiError("notInWar", 200, "notInWar") } : ok(war)),
    }),

  /** No CWL group this season is a 404 (or a notInWar answer); both become cwlNotActive. */
  leagueGroup: (request: Requester, tag: string) =>
    fetchOne(request, {
      path: byTag(tag, (t) => `/clans/${t}/currentwar/leaguegroup`),
      schema: LeagueGroupSchema,
      life: "war",
      map: (group) =>
        group.state === "notInWar" ? { ok: false, error: apiError("cwlNotActive", 200, "notInWar") } : ok(group),
      onError: (error) =>
        error.kind === "notFound"
          ? { result: { ok: false, error: apiError("cwlNotActive", 404, error.reason) }, life: "war" }
          : undefined,
    }),

  cwlWar: (request: Requester, warTag: string) =>
    fetchOne(request, { path: byTag(warTag, (t) => `/clanwarleagues/wars/${t}`), schema: WarSchema, life: "war" }),

  capitalRaids: (request: Requester, tag: string) =>
    fetchOne(request, {
      path: byTag(tag, (t) => `/clans/${t}/capitalraidseasons?limit=${CAPITAL_RAIDS_LIMIT}`),
      schema: CapitalRaidSeasonsSchema,
      life: "profile",
      map: (data) => ok(data.items),
    }),

  // ---------- Players ----------

  player: (request: Requester, tag: string) =>
    fetchOne(request, { path: byTag(tag, (t) => `/players/${t}`), schema: PlayerSchema, life: "profile" }),

  /** The player's last ~40-50 battles (a few days), newest first. */
  battleLog: (request: Requester, tag: string) =>
    fetchOne(request, {
      path: byTag(tag, (t) => `/players/${t}/battlelog`),
      schema: BattleLogSchema,
      life: "war",
      map: (data) => ok(newestFirst(data.items)),
    }),

  /**
   * Current trophies and battle log fetched together and cached as one entry.
   * The Legend I season page rebuilds day-by-day trophies backwards from the
   * current count, which only works if both come from the same moment.
   */
  legendSnapshot: async (
    request: Requester,
    rawTag: string,
  ): Promise<Fetched<{ trophies: number | null; battles: BattleLogEntry[] }>> => {
    const [player, log] = await Promise.all([
      endpoints.player(request, rawTag),
      endpoints.battleLog(request, rawTag),
    ]);
    if (!player.result.ok) return { result: player.result, life: player.life };
    if (!log.result.ok) return { result: log.result, life: log.life };
    return { result: ok({ trophies: player.result.data.trophies ?? null, battles: log.result.data }), life: "war" };
  },

  /** A player's weekly ranked league group with their attack and defense logs. */
  rankedGroup: (request: Requester, groupTag: string, seasonId: number, playerTag: string) => {
    const group = normalizeTag(groupTag);
    const player = normalizeTag(playerTag);
    const valid = group && player && Number.isSafeInteger(seasonId) && seasonId > 0;
    return fetchOne(request, {
      path: valid ? `/leaguegroup/${encodeTag(group)}/${seasonId}?playerTag=${encodeTag(player)}` : null,
      schema: RankedGroupSchema,
      life: "war",
    });
  },

  /** Finished ranked seasons, newest first. */
  leagueHistory: (request: Requester, tag: string) =>
    fetchOne(request, {
      path: byTag(tag, (t) => `/players/${t}/leaguehistory`),
      schema: LeagueHistorySchema,
      life: "profile",
      map: (data) => ok([...data.items].sort((a, b) => b.leagueSeasonId - a.leagueSeasonId)),
    }),

  /** All ranked league tiers (names and icons), to resolve `leagueTierId`. */
  leagueTiers: (request: Requester) =>
    fetchOne(request, {
      path: `/leaguetiers?limit=100`,
      schema: LeagueTiersSchema,
      life: "reference",
      map: (data) => ok(data.items),
    }),

  // ---------- Locations and leaderboards ----------

  locations: (request: Requester) =>
    fetchOne(request, {
      path: `/locations?limit=300`,
      schema: LocationsSchema,
      life: "reference",
      map: (data) => ok(data.items),
    }),

  /** `location` is "global" or a numeric location id from /locations. */
  playerRankings: (request: Requester, location: string) =>
    fetchOne(request, {
      path: byLocation(location, (l) => `/locations/${l}/rankings/players?limit=${LIVE_RANKINGS_LIMIT}`),
      invalid: BAD_LOCATION,
      schema: PlayerRankingsSchema,
      life: "leaderboard",
      map: (data) => ok<PlayerRanking[]>(data.items),
    }),

  clanRankings: (request: Requester, location: string) =>
    fetchOne(request, {
      path: byLocation(location, (l) => `/locations/${l}/rankings/clans?limit=${LIVE_RANKINGS_LIMIT}`),
      invalid: BAD_LOCATION,
      schema: ClanRankingsSchema,
      life: "leaderboard",
      map: (data) => ok<ClanRanking[]>(data.items),
    }),

  // Builder Base and Clan Capital rankings use the same location ids and the
  // same 200-row limit. They're mapped onto the main ranking shapes (the
  // points go in `trophies` / `clanPoints`) so the same tables can show them.

  builderBasePlayerRankings: (request: Requester, location: string) =>
    fetchOne(request, {
      path: byLocation(location, (l) => `/locations/${l}/rankings/players-builder-base?limit=${LIVE_RANKINGS_LIMIT}`),
      invalid: BAD_LOCATION,
      schema: BuilderBasePlayerRankingsSchema,
      life: "leaderboard",
      map: (data) =>
        ok<PlayerRanking[]>(data.items.map(({ builderBaseTrophies, ...r }) => ({ ...r, trophies: builderBaseTrophies }))),
    }),

  builderBaseClanRankings: (request: Requester, location: string) =>
    fetchOne(request, {
      path: byLocation(location, (l) => `/locations/${l}/rankings/clans-builder-base?limit=${LIVE_RANKINGS_LIMIT}`),
      invalid: BAD_LOCATION,
      schema: BuilderBaseClanRankingsSchema,
      life: "leaderboard",
      map: (data) =>
        ok<ClanRanking[]>(data.items.map(({ clanBuilderBasePoints, ...r }) => ({ ...r, clanPoints: clanBuilderBasePoints }))),
    }),

  capitalRankings: (request: Requester, location: string) =>
    fetchOne(request, {
      path: byLocation(location, (l) => `/locations/${l}/rankings/capitals?limit=${LIVE_RANKINGS_LIMIT}`),
      invalid: BAD_LOCATION,
      schema: CapitalRankingsSchema,
      life: "leaderboard",
      map: (data) =>
        ok<ClanRanking[]>(data.items.map(({ clanCapitalPoints, ...r }) => ({ ...r, clanPoints: clanCapitalPoints }))),
    }),

  /** Finished Legend I seasons, newest first. */
  legendSeasons: (request: Requester) =>
    fetchOne(request, {
      path: `/leagues/${LEGEND_LEAGUE_ID}/seasons?limit=500`,
      schema: LegendSeasonsSchema,
      life: "reference",
      map: (data) => ok(data.items.map((s) => s.id).filter(isLegendSeasonId).reverse()),
    }),

  /**
   * One page (100 players) of a finished Legend I season's final standings.
   * The archive holds every Legend I player of that season (about 12,000),
   * where the live rankings stop at 200. A finished season never changes, so
   * it's kept as long as reference data rather than the 1-hour leaderboards.
   */
  legendSeasonRankings: (request: Requester, seasonId: string, page: number) => {
    const valid = isLegendSeasonId(seasonId) && Number.isSafeInteger(page) && page >= 1;
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    const after = valid ? archiveCursor(page) : null;
    if (after) query.set("after", after);
    return fetchOne(request, {
      path: valid ? `/leagues/${LEGEND_LEAGUE_ID}/seasons/${encodeURIComponent(seasonId)}?${query}` : null,
      invalid: BAD_SEASON,
      schema: PlayerRankingsSchema,
      life: "reference",
      map: (data): ApiResult<RankingPage<PlayerRanking>> =>
        ok({ items: data.items, hasMore: Boolean(data.paging?.cursors?.after) }),
    });
  },

  // ---------- Reference data ----------

  /** Clan labels ("Clan Wars", "Farming", ...) with icons, for the search filter. */
  clanLabels: (request: Requester) =>
    fetchOne(request, { path: `/labels/clans`, schema: LabelsSchema, life: "reference", map: (data) => ok(data.items) }),

  /** The current monthly season (the Gold Pass season). */
  goldPassSeason: (request: Requester) =>
    fetchOne(request, { path: `/goldpass/seasons/current`, schema: GoldPassSeasonSchema, life: "leaderboard" }),
};

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
export type EndpointArgs<K extends EndpointName> = Endpoints[K] extends (request: Requester, ...args: infer A) => unknown
  ? A
  : never;
export type EndpointData<K extends EndpointName> = Endpoints[K] extends (
  ...args: never[]
) => Promise<Fetched<infer T>>
  ? T
  : never;
