// War results: the one place that decides a war's result, whether from the
// API's war log or computed from the score, and how it's labelled and
// coloured. Safe to import from client code.

import type { WarClan, WarLogEntry } from "./schemas";

/** A decided war, from one clan's point of view. */
export type WarOutcome = "win" | "lose" | "tie";

/** Anything a war row can show: a decided war, a CWL season row, or a result the API didn't give. */
export type WarResult = WarOutcome | "cwl" | "unknown";

export interface ResultStyle {
  label: string;
  /** Tailwind classes for a small result badge. */
  badge: string;
  /** CSS colour for chart marks and legend swatches. */
  color: string;
}

const NEUTRAL = "bg-muted text-muted-foreground";

export const RESULT_STYLE: Record<WarResult, ResultStyle> = {
  win: { label: "Win", badge: "bg-win/15 text-win-foreground", color: "var(--win)" },
  lose: { label: "Loss", badge: "bg-loss/15 text-loss-foreground", color: "var(--loss)" },
  tie: { label: "Tie", badge: NEUTRAL, color: "var(--tie)" },
  cwl: { label: "CWL", badge: NEUTRAL, color: "var(--tie)" },
  unknown: { label: "–", badge: NEUTRAL, color: "var(--tie)" },
};

export function isOutcome(result: WarResult): result is WarOutcome {
  return result === "win" || result === "lose" || result === "tie";
}

/** Outcome from `side`'s point of view: stars first, then destruction. */
export function warOutcome(side: WarClan | undefined, other: WarClan | undefined): WarOutcome {
  const a = side?.stars ?? 0;
  const b = other?.stars ?? 0;
  if (a !== b) return a > b ? "win" : "lose";
  const da = side?.destructionPercentage ?? 0;
  const db = other?.destructionPercentage ?? 0;
  if (da !== db) return da > db ? "win" : "lose";
  return "tie";
}

/** War log rows for a CWL season have no opponent. */
export function isCwlLogEntry(entry: Pick<WarLogEntry, "opponent">): boolean {
  return !entry.opponent.tag;
}

/**
 * A war log row's result. The API's `result` is an open string that can be
 * missing; anything but win, lose or tie is "unknown" rather than a guess.
 */
export function warLogResult(entry: Pick<WarLogEntry, "opponent" | "result">): WarResult {
  if (isCwlLogEntry(entry)) return "cwl";
  const r = entry.result;
  return r === "win" || r === "lose" || r === "tie" ? r : "unknown";
}
