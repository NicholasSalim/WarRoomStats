import "server-only";

// Typed, cached Clash of Clans API client. Server-only: the API token never
// reaches the browser. Every function returns an ApiResult instead of
// throwing, so pages can render a specific message for each error kind.
//
// What each endpoint fetches, and how long its answer may be cached, lives in
// endpoints.ts. This module adds the shared `use cache: remote` boundary.
// Tags and search parameters are normalised before that boundary, so "2pp",
// "#2PP" and the URL slug share one cache entry and one upstream call.

import { cacheLife } from "next/cache";
import { apiError, type ApiResult } from "./errors";
import { fixtureFetch } from "./fixtures";
import { normalizeClanSearch, type ClanSearchItem, type ClanSearchParams } from "./clan-search";
import {
  endpoints,
  type EndpointArgs,
  type EndpointData,
  type EndpointName,
  INVALID_TAG,
  type Fetched,
  type Requester,
} from "./endpoints";
import { normalizeTag } from "./tag";
import { cocRequest, type TransportConfig } from "./transport";

export type { ClanSearchParams } from "./clan-search";
export type { RankingPage } from "./endpoints";

const DEFAULT_BASE_URL = "https://cocproxy.royaleapi.dev/v1";

function transportConfig(): TransportConfig | null {
  // Fixture mode for local development and tests without an API token. Also
  // works in a local production build (the smoke tests run against one), but
  // never on Vercel; next.config.ts refuses to build there with it set.
  if (process.env.COC_API_MOCK === "1" && !process.env.VERCEL) {
    return { baseUrl: "mock://coc", token: "mock", fetchImpl: fixtureFetch };
  }
  const token = process.env.COC_API_TOKEN;
  if (!token) {
    console.error("[coc] COC_API_TOKEN is not set");
    return null;
  }
  return { baseUrl: process.env.COC_API_BASE_URL || DEFAULT_BASE_URL, token };
}

const request: Requester = async (path, schema) => {
  const config = transportConfig();
  if (!config) return { ok: false, error: apiError("unavailable", 0, "missingToken") };
  return cocRequest(config, path, schema);
};

/**
 * The one cache boundary for every endpoint. The cache key is the endpoint
 * name plus its (already normalised) arguments; the lifetime comes from the
 * endpoint, and is short for failures.
 */
async function load<K extends EndpointName>(name: K, ...args: EndpointArgs<K>): Promise<ApiResult<EndpointData<K>>> {
  "use cache: remote";
  const run = endpoints[name] as unknown as (
    request: Requester,
    ...args: EndpointArgs<K>
  ) => Promise<Fetched<EndpointData<K>>>;
  const { result, life } = await run(request, ...args);
  // One literal per call: cacheLife's types take a profile name, not a variable.
  switch (life) {
    case "war":
      cacheLife("war");
      break;
    case "profile":
      cacheLife("profile");
      break;
    case "leaderboard":
      cacheLife("leaderboard");
      break;
    case "reference":
      cacheLife("reference");
      break;
    case "apiError":
      cacheLife("apiError");
      break;
    case "max":
      cacheLife("max");
      break;
  }
  return result;
}

function invalidTag<T>(): Promise<ApiResult<T>> {
  return Promise.resolve({ ok: false, error: INVALID_TAG });
}

/** Endpoints whose only argument is a tag. */
type TagEndpoint = { [K in EndpointName]: EndpointArgs<K> extends [string] ? K : never }[EndpointName];

/** Loads a tag-keyed endpoint under the canonical tag; invalid tags never reach the cache. */
function loadByTag<K extends TagEndpoint>(name: K, rawTag: string): Promise<ApiResult<EndpointData<K>>> {
  const tag = normalizeTag(rawTag);
  return tag ? load(name, ...([tag] as EndpointArgs<K>)) : invalidTag();
}

// ---------- Clans ----------

export const getClan = (tag: string) => loadByTag("clan", tag);

/**
 * Every clan matching the search (the API stops at 832), trimmed for the
 * result list. Fetched once and cached; the search page pages it locally.
 * Equivalent searches ("War Machine", "war  machine") share one cache entry.
 */
export const searchClans = (params: ClanSearchParams): Promise<ApiResult<ClanSearchItem[]>> =>
  load("clanSearch", normalizeClanSearch(params));

/** Every war the game keeps for the clan, newest first. */
export const getWarLog = (tag: string) => loadByTag("warLog", tag);
/** Not being in a war is reported as the `notInWar` error. */
export const getCurrentWar = (tag: string) => loadByTag("currentWar", tag);
/** No CWL group this season is reported as the `cwlNotActive` error. */
export const getLeagueGroup = (tag: string) => loadByTag("leagueGroup", tag);
export const getCwlWar = (warTag: string) => loadByTag("cwlWar", warTag);
/** The clan's last 20 raid weekends, newest first. */
export const getCapitalRaids = (tag: string) => loadByTag("capitalRaids", tag);

// ---------- Players ----------

export const getPlayer = (tag: string) => loadByTag("player", tag);
/** The player's last ~40-50 battles (a few days), newest first. */
export const getBattleLog = (tag: string) => loadByTag("battleLog", tag);
/** Current trophies and battle log from the same moment, for the Legend I season page. */
export const getLegendSnapshot = (tag: string) => loadByTag("legendSnapshot", tag);
/** Finished ranked seasons, newest first. */
export const getLeagueHistory = (tag: string) => loadByTag("leagueHistory", tag);

/** A player's weekly ranked league group (from currentLeagueGroupTag/currentLeagueSeasonId). */
export function getRankedGroup(rawGroupTag: string, seasonId: number, rawPlayerTag: string) {
  // Tags are normalised for the cache key; the endpoint validates the rest.
  const groupTag = normalizeTag(rawGroupTag);
  const playerTag = normalizeTag(rawPlayerTag);
  if (!groupTag || !playerTag) return invalidTag<EndpointData<"rankedGroup">>();
  return load("rankedGroup", groupTag, seasonId, playerTag);
}

export const getLeagueTiers = () => load("leagueTiers");

// ---------- Locations and leaderboards ----------

export const getLocations = () => load("locations");
/** `location` is "global" or a numeric location id from /locations. */
export const getPlayerRankings = (location: string) => load("playerRankings", location);
export const getClanRankings = (location: string) => load("clanRankings", location);
export const getBuilderBasePlayerRankings = (location: string) => load("builderBasePlayerRankings", location);
export const getBuilderBaseClanRankings = (location: string) => load("builderBaseClanRankings", location);
export const getCapitalRankings = (location: string) => load("capitalRankings", location);
/** Finished Legend I seasons, newest first. */
export const getLegendSeasons = () => load("legendSeasons");
/** One page (100 players) of a finished Legend I season's final standings. */
export const getLegendSeasonRankings = (seasonId: string, page: number) => load("legendSeasonRankings", seasonId, page);

// ---------- Reference data ----------

export const getClanLabels = () => load("clanLabels");
/** The current monthly season (the Gold Pass season). */
export const getGoldPassSeason = () => load("goldPassSeason");
