// Player and clan tags. Safe to import from client code (no secrets here).

const TAG_PATTERN = /^#?[0289PYLQGRJCUV]+$/;

/**
 * Validates and normalises a player or clan tag.
 * Accepts "#2pp", "2PP", " %232PP " and returns "#2PP", or null when invalid.
 * The letter O is a common typo for 0, so it is corrected before validation.
 */
export function normalizeTag(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = input.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  raw = raw.replace(/\s+/g, "").toUpperCase().replace(/O/g, "0");
  if (raw.length < 2 || raw.length > 16) return null;
  if (!TAG_PATTERN.test(raw)) return null;
  return raw.startsWith("#") ? raw : `#${raw}`;
}

/**
 * Whether a path is a clan or player page whose tag can't exist, e.g.
 * /clan/notatag or /player/hello/battles. Checked by the proxy, without an
 * API call, so those URLs get a real 404 status.
 */
export function isImpossibleTagPath(pathname: string): boolean {
  const m = /^\/(?:clan|player)\/([^/]+)/.exec(pathname);
  return m !== null && normalizeTag(m[1]) === null;
}

/** "#2PP" -> "2PP", for use in app URLs such as /clan/2PP. */
export function tagToSlug(tag: string): string {
  return tag.replace(/^#/, "");
}

export function clanHref(tag: string): string {
  return `/clan/${tagToSlug(tag)}`;
}

export function playerHref(tag: string): string {
  return `/player/${tagToSlug(tag)}`;
}
