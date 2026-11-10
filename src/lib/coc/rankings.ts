// Pure helpers for the leaderboards: page maths, the Legend season archive's
// season ids and its paging cursors. No API calls here, so it is easy to test.

export const PAGE_SIZE = 100;

/** The live rankings endpoints return at most this many rows (checked live, 2026-11-09). */
export const LIVE_RANKINGS_LIMIT = 200;

/** The old "Legend League" id still serves the Legend I season archive. */
export const LEGEND_LEAGUE_ID = 29000022;

const DAY_MS = 86_400_000;

/** Reads a `page` search param: a whole number from 1, anything else is page 1. */
export function parsePage(raw: unknown): number {
  if (typeof raw !== "string" || !/^\d{1,5}$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** One page of an in-memory list (the live top 200). Pages past the end are empty. */
export function pageSlice<T>(items: readonly T[], page: number, size = PAGE_SIZE): T[] {
  return items.slice((page - 1) * size, page * size);
}

/**
 * The archive pages with opaque `after` cursors, which are base64 of
 * `{"pos":N}`. Building one directly lets a visitor open page 57 without
 * walking pages 1 to 56 first. Page 1 needs no cursor.
 */
export function archiveCursor(page: number, size = PAGE_SIZE): string | null {
  if (page <= 1) return null;
  return Buffer.from(JSON.stringify({ pos: (page - 1) * size })).toString("base64url");
}

/** Reverse of `archiveCursor`, for the fixture server. Bad cursors read as position 0. */
export function cursorPosition(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const pos = (JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { pos?: unknown }).pos;
    return typeof pos === "number" && Number.isSafeInteger(pos) && pos >= 0 ? pos : 0;
  } catch {
    return 0;
  }
}

// Season ids in the archive: "2015-07" (monthly, until 2025), "2026-04-20"
// (a short transition season) and "v2-2026-10-26T05:00:00Z" (the 28-day
// Legend I seasons after the league rework).
const SEASON_ID = /^(?:v2-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z|\d{4}-\d{2}(?:-\d{2})?)$/;

export function isLegendSeasonId(id: string): boolean {
  return SEASON_ID.test(id);
}

/**
 * When a v2 season ended. The id's timestamp is 7 days before the end:
 * archive "v2-2026-10-26T05:00:00Z" holds the same final standings as the
 * league-history season that ended 2026-11-02 05:00 UTC (checked live).
 */
export function legendSeasonEnd(id: string): Date | null {
  if (!id.startsWith("v2-")) return null;
  const start = Date.parse(id.slice(3));
  return Number.isNaN(start) ? null : new Date(start + 7 * DAY_MS);
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "Ended 2 Nov 2026" for v2 seasons, "July 2015" for monthly ones. */
export function legendSeasonLabel(id: string): string {
  const end = legendSeasonEnd(id);
  if (end) return `Ended ${DATE_FMT.format(end)}`;
  if (/^\d{4}-\d{2}$/.test(id)) return MONTH_FMT.format(new Date(`${id}-01T00:00:00Z`));
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return DATE_FMT.format(new Date(`${id}T00:00:00Z`));
  return id;
}
