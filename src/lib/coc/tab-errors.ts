import type { ApiError } from "./errors";

/**
 * Which errors a clan or player tab shows itself. The layout loads the clan or
 * player for its header and, when the tag is invalid or unknown, shows that
 * one message for the whole page; a tab whose own data fails for the same
 * reason must stay silent, or the message appears twice. Anything else (a
 * private war log, maintenance, ...) is about the tab's data, so the tab shows it.
 *
 * Only for data looked up by the page's own tag. Data about another entity,
 * like a player's clan on the player's Wars and Raids tabs, shows every error:
 * there, "not found" means that clan is gone, which the layout doesn't show.
 */
export function tabError(error: ApiError): ApiError | null {
  return error.kind === "invalidTag" || error.kind === "notFound" ? null : error;
}
