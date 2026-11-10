import "server-only";

// Typed, cached Clash of Clans API client. Server-only: the API token never
// reaches the browser. Every function returns an ApiResult instead of
// throwing, so pages can render a specific message for each error kind.
//
// Caching uses `use cache` + `cacheLife` profiles defined in next.config.ts.
// Failed calls switch to the short `apiError` profile so an outage or
// maintenance break is not remembered for the full lifetime.

import { cacheLife } from "next/cache";
import { apiError, type ApiResult } from "./errors";
import { fixtureFetch } from "./fixtures";
import {
  BattleLogSchema,
  BuilderBaseClanRankingsSchema,
  BuilderBasePlayerRankingsSchema,
  CapitalRankingsSchema,
  GoldPassSeasonSchema,
  LabelsSchema,
  CapitalRaidSeasonsSchema,
  ClanRankingsSchema,
  ClanSchema,
  ClanSearchSchema,
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
  type CapitalRaidSeason,
  type Clan,
  type ClanRanking,
  type GoldPassSeason,
  type Label,
  type LeagueGroup,
  type LeagueSeasonResult,
  type LeagueTier,
  type Location,
  type Player,
  type PlayerRanking,
  type RankedGroup,
  type War,
  type WarLog,
} from "./schemas";
import { LEGEND_LEAGUE_ID, LIVE_RANKINGS_LIMIT, PAGE_SIZE, archiveCursor, isLegendSeasonId } from "./rankings";
import {
  CLAN_SEARCH_LIMIT,
  normalizeClanSearch,
  toClanSearchItem,
  type ClanSearchItem,
  type ClanSearchParams,
} from "./clan-search";

export type { ClanSearchParams } from "./clan-search";
import { normalizeTag } from "./tag";
import { cocRequest, encodeTag, type TransportConfig } from "./transport";
import type { ZodType } from "zod";

const DEFAULT_BASE_URL = "https://cocproxy.royaleapi.dev/v1";

function transportConfig(): TransportConfig | null {
  // Fixture mode for local development and tests without an API token.
  // Never honoured in production builds.
  if (process.env.COC_API_MOCK === "1" && process.env.NODE_ENV !== "production") {
    return { baseUrl: "mock://coc", token: "mock", fetchImpl: fixtureFetch };
  }
  const token = process.env.COC_API_TOKEN;
  if (!token) {
    console.error("[coc] COC_API_TOKEN is not set");
    return null;
  }
  return { baseUrl: process.env.COC_API_BASE_URL || DEFAULT_BASE_URL, token };
}

async function request<T>(path: string, schema: ZodType<T>): Promise<ApiResult<T>> {
  const config = transportConfig();
  if (!config) return { ok: false, error: apiError("unavailable", 0, "missingToken") };
  return cocRequest(config, path, schema);
}

function invalidTag<T>(): ApiResult<T> {
  return { ok: false, error: apiError("invalidTag", 400) };
}

// ---------- Clans ----------

export async function getClan(rawTag: string): Promise<ApiResult<Clan>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/clans/${encodeTag(tag)}`, ClanSchema);
  if (result.ok) cacheLife("profile");
  else cacheLife("apiError");
  return result;
}

/**
 * Every clan matching the search (the API stops at 832), trimmed for the
 * result list. Fetched once and cached; the search page pages it locally.
 * Equivalent searches ("War Machine", "war  machine") share one cache entry.
 */
export function searchClans(params: ClanSearchParams): Promise<ApiResult<ClanSearchItem[]>> {
  return searchClansCached(normalizeClanSearch(params));
}

async function searchClansCached(params: ClanSearchParams): Promise<ApiResult<ClanSearchItem[]>> {
  "use cache: remote";
  // The API needs a name or at least one other filter; labels alone are enough.
  const query = new URLSearchParams({ limit: String(CLAN_SEARCH_LIMIT) });
  if (params.name) query.set("name", params.name);
  if (params.labelIds?.length) query.set("labelIds", params.labelIds.join(","));
  if (params.warFrequency) query.set("warFrequency", params.warFrequency);
  if (params.locationId) query.set("locationId", String(params.locationId));
  if (params.minMembers) query.set("minMembers", String(params.minMembers));
  if (params.maxMembers) query.set("maxMembers", String(params.maxMembers));
  if (params.minClanLevel) query.set("minClanLevel", String(params.minClanLevel));
  const result = await request(`/clans?${query}`, ClanSearchSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("profile");
  return { ok: true, data: result.data.items.map(toClanSearchItem) };
}

/**
 * Every war the game keeps for the clan, newest first. The API returns the
 * whole log in one call when asked for more than it has (60 to 140 wars,
 * back to 2016, about 130 KB; checked live 2026-11-10), with no next page.
 */
export const WAR_LOG_LIMIT = 10_000;

/**
 * The game keeps the last 20 raid weekends per clan (checked live
 * 2026-11-10: every clan returned 20, with no next page).
 */
export const CAPITAL_RAIDS_LIMIT = 20;

export async function getWarLog(rawTag: string, limit = WAR_LOG_LIMIT): Promise<ApiResult<WarLog>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/clans/${encodeTag(tag)}/warlog?limit=${limit}`, WarLogSchema);
  if (result.ok) cacheLife("profile");
  else cacheLife("apiError");
  return result;
}

export async function getCurrentWar(rawTag: string): Promise<ApiResult<War>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/clans/${encodeTag(tag)}/currentwar`, WarSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("war");
  if (result.data.state === "notInWar") {
    return { ok: false, error: apiError("notInWar", 200, "notInWar") };
  }
  return result;
}

export async function getLeagueGroup(rawTag: string): Promise<ApiResult<LeagueGroup>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/clans/${encodeTag(tag)}/currentwar/leaguegroup`, LeagueGroupSchema);
  if (!result.ok) {
    // The API answers 404 when the clan has no CWL group this season.
    if (result.error.kind === "notFound") {
      cacheLife("war");
      return { ok: false, error: apiError("cwlNotActive", 404, result.error.reason) };
    }
    cacheLife("apiError");
    return result;
  }
  cacheLife("war");
  if (result.data.state === "notInWar") {
    return { ok: false, error: apiError("cwlNotActive", 200, "notInWar") };
  }
  return result;
}

export async function getCwlWar(rawWarTag: string): Promise<ApiResult<War>> {
  "use cache: remote";
  const warTag = normalizeTag(rawWarTag);
  if (!warTag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/clanwarleagues/wars/${encodeTag(warTag)}`, WarSchema);
  if (result.ok) cacheLife("war");
  else cacheLife("apiError");
  return result;
}

export async function getCapitalRaids(rawTag: string, limit = CAPITAL_RAIDS_LIMIT): Promise<ApiResult<CapitalRaidSeason[]>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(
    `/clans/${encodeTag(tag)}/capitalraidseasons?limit=${limit}`,
    CapitalRaidSeasonsSchema,
  );
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("profile");
  return { ok: true, data: result.data.items };
}

// ---------- Players ----------

export async function getPlayer(rawTag: string): Promise<ApiResult<Player>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/players/${encodeTag(tag)}`, PlayerSchema);
  if (result.ok) cacheLife("profile");
  else cacheLife("apiError");
  return result;
}

/** The player's last ~40-50 battles (a few days), newest first. */
export async function getBattleLog(rawTag: string): Promise<ApiResult<BattleLogEntry[]>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/players/${encodeTag(tag)}/battlelog`, BattleLogSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("war");
  // The API lists battles oldest first; the compact timestamps sort as strings.
  const items = [...result.data.items].sort((a, b) => b.battleTimestamp.localeCompare(a.battleTimestamp));
  return { ok: true, data: items };
}

/**
 * Current trophies and battle log fetched together and cached as one entry.
 * The Legend I season page rebuilds day-by-day trophies backwards from the
 * current count, which only works if both come from the same moment (with
 * separate caches the log can include battles the trophy count doesn't).
 */
export async function getLegendSnapshot(
  rawTag: string,
): Promise<ApiResult<{ trophies: number | null; battles: BattleLogEntry[] }>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const [player, log] = await Promise.all([
    request(`/players/${encodeTag(tag)}`, PlayerSchema),
    request(`/players/${encodeTag(tag)}/battlelog`, BattleLogSchema),
  ]);
  if (!player.ok || !log.ok) {
    cacheLife("apiError");
    return player.ok ? (log as Extract<typeof log, { ok: false }>) : player;
  }
  cacheLife("war");
  const battles = [...log.data.items].sort((a, b) => b.battleTimestamp.localeCompare(a.battleTimestamp));
  return { ok: true, data: { trophies: player.data.trophies ?? null, battles } };
}

/**
 * A player's weekly ranked league group with their attack and defense logs.
 * The group tag and season id come from the player's currentLeagueGroupTag/currentLeagueSeasonId.
 */
export async function getRankedGroup(
  rawGroupTag: string,
  seasonId: number,
  rawPlayerTag: string,
): Promise<ApiResult<RankedGroup>> {
  "use cache: remote";
  const groupTag = normalizeTag(rawGroupTag);
  const playerTag = normalizeTag(rawPlayerTag);
  if (!groupTag || !playerTag || !Number.isSafeInteger(seasonId) || seasonId <= 0) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(
    `/leaguegroup/${encodeTag(groupTag)}/${seasonId}?playerTag=${encodeTag(playerTag)}`,
    RankedGroupSchema,
  );
  if (result.ok) cacheLife("war");
  else cacheLife("apiError");
  return result;
}

/** Finished ranked seasons, newest first. */
export async function getLeagueHistory(rawTag: string): Promise<ApiResult<LeagueSeasonResult[]>> {
  "use cache: remote";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    cacheLife("max");
    return invalidTag();
  }
  const result = await request(`/players/${encodeTag(tag)}/leaguehistory`, LeagueHistorySchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("profile");
  const items = [...result.data.items].sort((a, b) => b.leagueSeasonId - a.leagueSeasonId);
  return { ok: true, data: items };
}

/** All ranked league tiers (names and icons), to resolve `leagueTierId`. */
export async function getLeagueTiers(): Promise<ApiResult<LeagueTier[]>> {
  "use cache: remote";
  const result = await request(`/leaguetiers?limit=100`, LeagueTiersSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("reference");
  return { ok: true, data: result.data.items };
}

// ---------- Locations and leaderboards ----------

export async function getLocations(): Promise<ApiResult<Location[]>> {
  "use cache: remote";
  const result = await request(`/locations?limit=300`, LocationsSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("reference");
  return { ok: true, data: result.data.items };
}

/** `location` is "global" or a numeric location id from /locations. */
export async function getPlayerRankings(location: string, limit = LIVE_RANKINGS_LIMIT): Promise<ApiResult<PlayerRanking[]>> {
  "use cache: remote";
  if (location !== "global" && !/^\d+$/.test(location)) {
    cacheLife("max");
    return { ok: false, error: apiError("notFound", 400, "badLocation") };
  }
  const result = await request(`/locations/${location}/rankings/players?limit=${limit}`, PlayerRankingsSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("leaderboard");
  return { ok: true, data: result.data.items };
}

export async function getClanRankings(location: string, limit = LIVE_RANKINGS_LIMIT): Promise<ApiResult<ClanRanking[]>> {
  "use cache: remote";
  if (location !== "global" && !/^\d+$/.test(location)) {
    cacheLife("max");
    return { ok: false, error: apiError("notFound", 400, "badLocation") };
  }
  const result = await request(`/locations/${location}/rankings/clans?limit=${limit}`, ClanRankingsSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("leaderboard");
  return { ok: true, data: result.data.items };
}

/** Finished Legend I seasons, newest first. */
export async function getLegendSeasons(): Promise<ApiResult<string[]>> {
  "use cache: remote";
  const result = await request(`/leagues/${LEGEND_LEAGUE_ID}/seasons?limit=500`, LegendSeasonsSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("reference");
  return { ok: true, data: result.data.items.map((s) => s.id).filter(isLegendSeasonId).reverse() };
}

export interface RankingPage<T> {
  items: T[];
  /** True when the API has another page after this one. */
  hasMore: boolean;
}

/**
 * One page (100 players) of a finished Legend I season's final standings.
 * The archive holds every Legend I player of that season (about 12,000),
 * where the live rankings stop at 200.
 */
export async function getLegendSeasonRankings(
  seasonId: string,
  page: number,
): Promise<ApiResult<RankingPage<PlayerRanking>>> {
  "use cache: remote";
  if (!isLegendSeasonId(seasonId) || !Number.isSafeInteger(page) || page < 1) {
    cacheLife("max");
    return { ok: false, error: apiError("notFound", 400, "badSeason") };
  }
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  const after = archiveCursor(page);
  if (after) query.set("after", after);
  const result = await request(
    `/leagues/${LEGEND_LEAGUE_ID}/seasons/${encodeURIComponent(seasonId)}?${query}`,
    PlayerRankingsSchema,
  );
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  // A finished season never changes.
  cacheLife("reference");
  return { ok: true, data: { items: result.data.items, hasMore: Boolean(result.data.paging?.cursors?.after) } };
}

// Builder Base and Clan Capital rankings use the same location ids and the
// same 200-row limit. They're mapped onto the main ranking shapes (the
// points go in `trophies` / `clanPoints`) so the same tables can show them.

function badLocation<T>(location: string): ApiResult<T> | null {
  if (location === "global" || /^\d+$/.test(location)) return null;
  return { ok: false, error: apiError("notFound", 400, "badLocation") };
}

export async function getBuilderBasePlayerRankings(location: string): Promise<ApiResult<PlayerRanking[]>> {
  "use cache: remote";
  const bad = badLocation<PlayerRanking[]>(location);
  if (bad) {
    cacheLife("max");
    return bad;
  }
  const result = await request(
    `/locations/${location}/rankings/players-builder-base?limit=${LIVE_RANKINGS_LIMIT}`,
    BuilderBasePlayerRankingsSchema,
  );
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("leaderboard");
  return { ok: true, data: result.data.items.map(({ builderBaseTrophies, ...r }) => ({ ...r, trophies: builderBaseTrophies })) };
}

export async function getBuilderBaseClanRankings(location: string): Promise<ApiResult<ClanRanking[]>> {
  "use cache: remote";
  const bad = badLocation<ClanRanking[]>(location);
  if (bad) {
    cacheLife("max");
    return bad;
  }
  const result = await request(
    `/locations/${location}/rankings/clans-builder-base?limit=${LIVE_RANKINGS_LIMIT}`,
    BuilderBaseClanRankingsSchema,
  );
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("leaderboard");
  return { ok: true, data: result.data.items.map(({ clanBuilderBasePoints, ...r }) => ({ ...r, clanPoints: clanBuilderBasePoints })) };
}

export async function getCapitalRankings(location: string): Promise<ApiResult<ClanRanking[]>> {
  "use cache: remote";
  const bad = badLocation<ClanRanking[]>(location);
  if (bad) {
    cacheLife("max");
    return bad;
  }
  const result = await request(`/locations/${location}/rankings/capitals?limit=${LIVE_RANKINGS_LIMIT}`, CapitalRankingsSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("leaderboard");
  return { ok: true, data: result.data.items.map(({ clanCapitalPoints, ...r }) => ({ ...r, clanPoints: clanCapitalPoints })) };
}

// ---------- Reference data ----------

/** Clan labels ("Clan Wars", "Farming", ...) with icons, for the search filter. */
export async function getClanLabels(): Promise<ApiResult<Label[]>> {
  "use cache: remote";
  const result = await request(`/labels/clans`, LabelsSchema);
  if (!result.ok) {
    cacheLife("apiError");
    return result;
  }
  cacheLife("reference");
  return { ok: true, data: result.data.items };
}

/**
 * The current monthly season (the Gold Pass season). Season challenges and
 * clan donation counts reset when it ends.
 */
export async function getGoldPassSeason(): Promise<ApiResult<GoldPassSeason>> {
  "use cache: remote";
  const result = await request(`/goldpass/seasons/current`, GoldPassSeasonSchema);
  if (result.ok) cacheLife("leaderboard");
  else cacheLife("apiError");
  return result;
}
