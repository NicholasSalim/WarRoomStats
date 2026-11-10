// Display formatting. Pure and deterministic (no Date.now), so it is safe in
// prerendered Server Components. Relative times live in <RelativeTime>.

const intFmt = new Intl.NumberFormat("en-US");
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function fmtInt(n: number | null | undefined): string {
  return n == null ? "–" : intFmt.format(n);
}

export function fmtCompact(n: number | null | undefined): string {
  return n == null ? "–" : compactFmt.format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "–";
  return `${n.toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function fmtRatio(n: number | null): string {
  if (n == null) return "–";
  if (!Number.isFinite(n)) return "∞";
  return n.toFixed(2);
}

const ROLE_LABELS: Record<string, string> = {
  leader: "Leader",
  coLeader: "Co-leader",
  admin: "Elder",
  member: "Member",
  notMember: "Not a member",
};

export function roleLabel(role: string | undefined): string {
  return (role && ROLE_LABELS[role]) || "Member";
}

/** Sort weight: leader first. */
export function roleRank(role: string | undefined): number {
  return ({ leader: 0, coLeader: 1, admin: 2, member: 3 } as Record<string, number>)[role ?? ""] ?? 4;
}

const WAR_FREQUENCY: Record<string, string> = {
  always: "Always",
  moreThanOncePerWeek: "Twice a week",
  oncePerWeek: "Once a week",
  lessThanOncePerWeek: "Rarely",
  never: "Never",
  unknown: "Not set",
  any: "Any",
};

export function warFrequencyLabel(v: string | undefined): string {
  return (v && WAR_FREQUENCY[v]) || "Not set";
}

const CLAN_TYPE: Record<string, string> = {
  open: "Anyone can join",
  inviteOnly: "Invite only",
  closed: "Closed",
};

export function clanTypeLabel(v: string | undefined): string {
  return (v && CLAN_TYPE[v]) || "–";
}

const WAR_STATE: Record<string, string> = {
  preparation: "Preparation day",
  inWar: "Battle day",
  warEnded: "War ended",
  notInWar: "Not in war",
  ended: "Ended",
};

export function warStateLabel(v: string | undefined): string {
  return (v && WAR_STATE[v]) || "–";
}

const BATTLE_TYPE: Record<string, string> = {
  ranked: "Ranked",
  legend: "Legend",
  homeVillage: "Regular",
  builderBase: "Builder Base",
  friendly: "Friendly",
};

/** API battleType -> short label; unknown values are split from camelCase. */
export function battleTypeLabel(v: string): string {
  return BATTLE_TYPE[v] ?? v.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

/** Seconds -> "2m 21s". */
export function fmtDuration(seconds: number | undefined): string {
  if (seconds == null) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

/** "2026-11" or "2026-11-03" (CWL seasons from the live API) -> "November 2026". */
export function seasonLabel(season: string | undefined): string {
  if (!season) return "–";
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(season);
  if (!m) return season;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Short UTC date for prerender-safe output, e.g. "Nov 7, 2026". */
export function fmtDate(d: Date | null): string {
  if (!d) return "–";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
