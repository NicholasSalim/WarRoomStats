// Clan search results, trimmed to what the result list shows. A full search
// response is about 1.4 MB for 832 clans; the trimmed list is a fraction of
// that, so all matches can be cached once and paged locally. Also reads a
// search from the URL. Pure: safe to import from client code.

import { WAR_FREQUENCY_FILTERS } from "../format";
import { parsePage } from "../paging";
import { normalizeTag } from "./tag";

/**
 * The API returns at most 832 clans per search, however broad the name
 * (checked live with "clan", "war" and "dragons", 2026-11-09). Asking for
 * more is harmless.
 */
export const CLAN_SEARCH_LIMIT = 1000;

/** The most clans one search returns; at this size the list was cut short. */
export const CLAN_SEARCH_API_MAX = 832;

export const CLAN_SEARCH_PAGE_SIZE = 50;

/** Clans carry at most 3 labels, so a search for more can never match. */
export const MAX_LABELS = 3;

export interface ClanSearchParams {
  /** Optional when labels are given. */
  name?: string;
  warFrequency?: string;
  locationId?: number;
  minMembers?: number;
  maxMembers?: number;
  minClanLevel?: number;
  /** Up to 3 label ids; matching clans carry every one. */
  labelIds?: number[];
}

/**
 * One form per distinct search, used as its cache key. The API ignores case
 * and repeated spaces in names (checked live 2026-11-10: "war machine",
 * "War Machine", "WAR MACHINE" and "war  machine" return the same clans),
 * and label order doesn't matter. Unset filters are dropped.
 */
export function normalizeClanSearch(params: ClanSearchParams): ClanSearchParams {
  const out: ClanSearchParams = {};
  const name = params.name?.trim().replace(/\s+/g, " ").toLowerCase();
  if (name) out.name = name;
  if (params.labelIds?.length) out.labelIds = [...new Set(params.labelIds)].sort((a, b) => a - b);
  if (params.warFrequency) out.warFrequency = params.warFrequency;
  if (params.locationId != null) out.locationId = params.locationId;
  if (params.minMembers != null) out.minMembers = params.minMembers;
  if (params.maxMembers != null) out.maxMembers = params.maxMembers;
  if (params.minClanLevel != null) out.minClanLevel = params.minClanLevel;
  return out;
}

export interface ClanSearchItem {
  tag: string;
  name: string;
  badge?: string;
  clanLevel: number;
  location?: string;
  warLeague?: string;
  warFrequency?: string;
  isWarLogPublic?: boolean;
  clanPoints: number;
  members: number;
}

interface ClanLike {
  tag: string;
  name: string;
  badgeUrls?: { small?: string };
  clanLevel: number;
  location?: { name: string };
  warLeague?: { name: string };
  warFrequency?: string;
  isWarLogPublic?: boolean;
  clanPoints: number;
  members: number;
}

export function toClanSearchItem(c: ClanLike): ClanSearchItem {
  return {
    tag: c.tag,
    name: c.name,
    badge: c.badgeUrls?.small,
    clanLevel: c.clanLevel,
    location: c.location?.name,
    warLeague: c.warLeague?.name,
    warFrequency: c.warFrequency,
    isWarLogPublic: c.isWarLogPublic,
    clanPoints: c.clanPoints,
    members: c.members,
  };
}

// ---------- Reading a search from the URL ----------

const WAR_FREQUENCIES = new Set<string>(WAR_FREQUENCY_FILTERS);

function intParam(
  v: string | string[] | undefined,
  min: number,
  max: number,
): number | undefined {
  if (typeof v !== "string" || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}


function labelParam(v: string | string[] | undefined): number[] {
  const raw = (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) =>
    x.split(","),
  );
  const ids = raw.filter((x) => /^56\d{6}$/.test(x)).map(Number);
  return [...new Set(ids)].slice(0, MAX_LABELS);
}

export interface ParsedClanSearch {
  params: ClanSearchParams;
  /** The search as a query string without the page: the key for recent searches. */
  canonical: string;
  /** The query read as a clan tag, when it has a tag's shape. */
  tag: string | null;
  /** The query started with "#": it's only a tag, never a name. */
  tagOnly: boolean;
  /** What the visitor typed, for the search bar. */
  query: string;
  /** The search params that identify this search (everything but the page). */
  pagerParams: Record<string, string>;
  page: number;
}

/**
 * Validates search params. The `name` box takes a clan name or a clan tag:
 * "#2PRGP0L22" is only a tag; "2PRGP0L22" is tried as both (names can use
 * the same letters). Needs a name, a tag or a label.
 */
export function parseClanSearch(
  sp: Record<string, string | string[] | undefined>,
): ParsedClanSearch | null {
  const query = typeof sp.name === "string" ? sp.name.trim().replace(/\s+/g, " ").slice(0, 50) : "";
  const tag = normalizeTag(query);
  const tagOnly = query.startsWith("#") || query.startsWith("%23");
  const name = !tagOnly && query.length >= 3 ? query : undefined;
  const labelIds = labelParam(sp.labelIds);
  if (!name && !tag && labelIds.length === 0) return null;
  const params: ClanSearchParams = {
    name,
    labelIds,
    warFrequency:
      typeof sp.warFrequency === "string" &&
      WAR_FREQUENCIES.has(sp.warFrequency)
        ? sp.warFrequency
        : undefined,
    locationId: intParam(sp.locationId, 32000000, 32999999),
    minMembers: intParam(sp.minMembers, 2, 50),
    minClanLevel: intParam(sp.minClanLevel, 2, 50),
  };
  const q = new URLSearchParams();
  if (name) q.set("name", name);
  if (labelIds.length > 0) q.set("labelIds", labelIds.join(","));
  for (const key of [
    "warFrequency",
    "locationId",
    "minMembers",
    "minClanLevel",
  ] as const) {
    if (params[key] != null) q.set(key, String(params[key]));
  }
  return {
    params,
    canonical: q.toString(),
    tag,
    tagOnly: tagOnly && !!tag,
    query,
    // Keep what was typed (a tag-shaped name too), so every page repeats the same search.
    pagerParams: Object.fromEntries([...(query ? [["name", query]] : []), ...[...q].filter(([k]) => k !== "name")]),
    page: parsePage(sp.page),
  };
}
