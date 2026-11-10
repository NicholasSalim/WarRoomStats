// Clan search results, trimmed to what the result list shows. A full search
// response is about 1.4 MB for 832 clans; the trimmed list is a fraction of
// that, so all matches can be cached once and paged locally.

/**
 * The API returns at most 832 clans per search, however broad the name
 * (checked live with "clan", "war" and "dragons", 2026-11-09). Asking for
 * more is harmless.
 */
export const CLAN_SEARCH_LIMIT = 1000;

/** The most clans one search returns; at this size the list was cut short. */
export const CLAN_SEARCH_API_MAX = 832;

export const CLAN_SEARCH_PAGE_SIZE = 50;

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
