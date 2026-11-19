// Paging for lists the app holds in full (the live top 200, the war log,
// clan search results) and cuts into pages itself.

/** Reads a `page` search param: a whole number from 1, anything else is page 1. */
export function parsePage(raw: unknown): number {
  if (typeof raw !== "string" || !/^\d{1,5}$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

export interface Paginated<T> {
  /** The requested page, clamped to the last page. */
  page: number;
  /** At least 1, so an empty list still has a page to show. */
  totalPages: number;
  shown: T[];
  /** 1-based position of the first shown item, for "Showing 51–100". */
  from: number;
}

export function paginate<T>(items: readonly T[], requestedPage: number, size: number): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * size;
  return { page, totalPages, shown: items.slice(start, start + size), from: start + 1 };
}
