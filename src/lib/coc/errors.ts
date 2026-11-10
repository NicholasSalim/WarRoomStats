// Error kinds the UI distinguishes (docs/DECISIONS.md > Architecture > Error states).
// Plain serialisable data, so results can cross a `use cache` boundary.

export type ApiErrorKind =
  | "invalidTag"
  | "notFound"
  | "privateWarLog"
  | "notInWar"
  | "cwlNotActive"
  | "maintenance"
  | "rateLimited"
  | "unavailable";

export interface ApiError {
  kind: ApiErrorKind;
  status: number;
  /** Upstream `reason`, kept for logs only. Never shown raw to users. */
  reason?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export function apiError(kind: ApiErrorKind, status: number, reason?: string): ApiError {
  return reason ? { kind, status, reason } : { kind, status };
}

/** Maps an upstream HTTP status and CoC `reason` to an error kind. */
export function classifyHttpError(status: number, reason?: string): ApiError {
  if (status === 404) return apiError("notFound", status, reason);
  if (status === 403 && reason === "accessDenied") return apiError("privateWarLog", status, reason);
  if (status === 429) return apiError("rateLimited", status, reason);
  if (status === 503) return apiError("maintenance", status, reason);
  return apiError("unavailable", status, reason);
}

export const ERROR_COPY: Record<ApiErrorKind, { title: string; body: string }> = {
  invalidTag: {
    title: "That tag doesn't look right",
    body: "Tags only use the characters 0 2 8 9 P Y L Q G R J C U V. Check it in-game under the player or clan profile.",
  },
  notFound: {
    title: "Not found",
    body: "Nothing exists with that tag. Double-check it and try again.",
  },
  privateWarLog: {
    title: "War log is private",
    body: "This clan keeps its war log private, so wars and league data can't be shown. A leader or co-leader can make it public in clan settings.",
  },
  notInWar: {
    title: "Not in a war",
    body: "This clan isn't in a regular war right now. Check back when the next war starts.",
  },
  cwlNotActive: {
    title: "No Clan War League this season",
    body: "This clan isn't in a Clan War League group right now. CWL runs during the first days of each month.",
  },
  maintenance: {
    title: "Game maintenance",
    body: "The game's API is down for maintenance. Data will be back once the break is over.",
  },
  rateLimited: {
    title: "Slow down a little",
    body: "Too many requests in a short time. Wait a moment and try again.",
  },
  unavailable: {
    title: "Couldn't load data",
    body: "The game's API didn't respond as expected. Try again in a moment.",
  },
};
