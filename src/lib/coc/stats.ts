// Pure stat calculations over CoC API data. No I/O, so they're safe to use
// anywhere and are covered by unit tests against fixtures.

import type {
  BattleLogEntry,
  LeagueGroup,
  PlayerUnit,
  RankedLogEntry,
  War,
  WarAttack,
  WarClan,
  WarLogEntry,
} from "./schemas";

/** Parses the API's compact timestamp format, e.g. "20261107T120000.000Z". */
export function parseApiTime(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms ? +ms : 0));
}

export type WarOutcome = "win" | "lose" | "tie";

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

// ---------- Current war ----------

export interface WarMemberRow {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  attacksUsed: number;
  attacksAllowed: number;
  stars: number;
  /** Stars that improved on the best earlier attack against the same base. */
  newStars: number;
  avgDestruction: number;
  triples: number;
  /** Best attack against this member's base, if any. */
  defenseStars: number | null;
  defenseDestruction: number | null;
  /** This member's attacks in the order they were made. */
  attacks: WarAttack[];
}

/** Stars each attack added on top of earlier attacks on the same base, keyed by "attacker|order". */
export function newStarsByAttack(war: War): Map<string, number> {
  const all = [...(war.clan?.members ?? []), ...(war.opponent?.members ?? [])].flatMap((m) => m.attacks ?? []);
  all.sort((a, b) => a.order - b.order);
  const best = new Map<string, number>();
  const out = new Map<string, number>();
  for (const atk of all) {
    const prev = best.get(atk.defenderTag) ?? 0;
    out.set(`${atk.attackerTag}|${atk.order}`, Math.max(0, atk.stars - prev));
    best.set(atk.defenderTag, Math.max(prev, atk.stars));
  }
  return out;
}

export function warMemberRows(war: War, side: "clan" | "opponent"): WarMemberRow[] {
  const members = war[side]?.members ?? [];
  const perMember = war.attacksPerMember ?? 2;
  const fresh = newStarsByAttack(war);
  return members
    .map((m) => {
      const attacks = m.attacks ?? [];
      const stars = attacks.reduce((s, a) => s + a.stars, 0);
      return {
        tag: m.tag,
        name: m.name,
        townhallLevel: m.townhallLevel,
        mapPosition: m.mapPosition,
        attacksUsed: attacks.length,
        attacksAllowed: perMember,
        stars,
        newStars: attacks.reduce((s, a) => s + (fresh.get(`${a.attackerTag}|${a.order}`) ?? 0), 0),
        avgDestruction: attacks.length ? attacks.reduce((s, a) => s + a.destructionPercentage, 0) / attacks.length : 0,
        triples: attacks.filter((a) => a.stars === 3).length,
        defenseStars: m.bestOpponentAttack?.stars ?? null,
        defenseDestruction: m.bestOpponentAttack?.destructionPercentage ?? null,
        attacks: [...attacks].sort((a, b) => a.order - b.order),
      };
    })
    .sort((a, b) => a.mapPosition - b.mapPosition);
}

export interface WarSideSummary {
  attacksUsed: number;
  attacksAllowed: number;
  triples: number;
  /** Sum of stars over all attacks (not the war score, which counts each base once). */
  attackStars: number;
  /** Stars by star count: index 0..3 = number of attacks with that many stars. */
  starSpread: [number, number, number, number];
}

export function warSideSummary(war: War, side: "clan" | "opponent"): WarSideSummary {
  const members = war[side]?.members ?? [];
  const attacks = members.flatMap((m) => m.attacks ?? []);
  const spread: [number, number, number, number] = [0, 0, 0, 0];
  for (const a of attacks) spread[Math.max(0, Math.min(3, a.stars))] += 1;
  return {
    attacksUsed: attacks.length,
    attacksAllowed: (war.teamSize ?? members.length) * (war.attacksPerMember ?? 2),
    triples: spread[3],
    attackStars: attacks.reduce((s, a) => s + a.stars, 0),
    starSpread: spread,
  };
}

// ---------- War log ----------

export interface WarLogSummary {
  wars: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  avgStarsPerWar: number;
  avgDestruction: number;
}

/** Regular wars only. CWL entries (no result, no opponent tag) are skipped. */
export function summarizeWarLog(items: WarLogEntry[]): WarLogSummary {
  const regular = items.filter((w) => w.result && w.opponent.tag);
  const wins = regular.filter((w) => w.result === "win").length;
  const losses = regular.filter((w) => w.result === "lose").length;
  const ties = regular.filter((w) => w.result === "tie").length;
  const n = regular.length;
  return {
    wars: n,
    wins,
    losses,
    ties,
    winRate: n ? wins / n : 0,
    avgStarsPerWar: n ? regular.reduce((s, w) => s + (w.clan.stars ?? 0), 0) / n : 0,
    avgDestruction: n ? regular.reduce((s, w) => s + (w.clan.destructionPercentage ?? 0), 0) / n : 0,
  };
}

export function isCwlLogEntry(entry: WarLogEntry): boolean {
  return !entry.opponent.tag;
}

// ---------- CWL ----------

export interface CwlRound {
  round: number;
  /** Wars in this round that have been fetched. Unstarted rounds are empty. */
  wars: War[];
}

export interface CwlStanding {
  tag: string;
  name: string;
  badge?: string;
  stars: number;
  /** Stars plus the 10-star bonus per war win, the in-game ranking metric. */
  points: number;
  destruction: number;
  wins: number;
  losses: number;
  ties: number;
  played: number;
}

/** In-game CWL ranking: stars + 10 per win, tie-broken by total destruction. */
export function cwlStandings(group: LeagueGroup, rounds: CwlRound[]): CwlStanding[] {
  const table = new Map<string, CwlStanding>(
    group.clans.map((c) => [
      c.tag,
      { tag: c.tag, name: c.name, badge: c.badgeUrls?.small, stars: 0, points: 0, destruction: 0, wins: 0, losses: 0, ties: 0, played: 0 },
    ]),
  );
  for (const { wars } of rounds) {
    for (const war of wars) {
      if (war.state === "preparation" || war.state === "notInWar") continue;
      const ended = war.state === "warEnded";
      for (const [side, other] of [
        [war.clan, war.opponent],
        [war.opponent, war.clan],
      ] as const) {
        const row = side?.tag ? table.get(side.tag) : undefined;
        if (!row) continue;
        row.stars += side?.stars ?? 0;
        row.destruction += side?.destructionPercentage ?? 0;
        if (ended) {
          row.played += 1;
          const outcome = warOutcome(side, other);
          if (outcome === "win") row.wins += 1;
          else if (outcome === "lose") row.losses += 1;
          else row.ties += 1;
        }
      }
    }
  }
  for (const row of table.values()) row.points = row.stars + row.wins * 10;
  return [...table.values()].sort((a, b) => b.points - a.points || b.destruction - a.destruction);
}

/** The war a given clan fought in a round, oriented so `clan` is that clan. */
export function warForClan(wars: War[], clanTag: string): War | null {
  for (const war of wars) {
    if (war.clan?.tag === clanTag) return war;
    if (war.opponent?.tag === clanTag) return { ...war, clan: war.opponent, opponent: war.clan };
  }
  return null;
}

export interface CwlPlayerRow {
  tag: string;
  name: string;
  townhallLevel: number;
  warsIn: number;
  attacks: number;
  missed: number;
  stars: number;
  triples: number;
  avgStars: number;
  avgDestruction: number;
  starsConceded: number;
  defenses: number;
}

/** Per-player CWL season stats for one clan, from that clan's wars. */
export function cwlPlayerStats(clanTag: string, rounds: CwlRound[]): CwlPlayerRow[] {
  const rows = new Map<string, CwlPlayerRow & { destructionSum: number }>();
  for (const { wars } of rounds) {
    const war = warForClan(wars, clanTag);
    if (!war || war.state === "preparation") continue;
    const ended = war.state === "warEnded";
    for (const m of war.clan?.members ?? []) {
      const row =
        rows.get(m.tag) ??
        { tag: m.tag, name: m.name, townhallLevel: m.townhallLevel, warsIn: 0, attacks: 0, missed: 0, stars: 0, triples: 0, avgStars: 0, avgDestruction: 0, starsConceded: 0, defenses: 0, destructionSum: 0 };
      row.name = m.name;
      row.townhallLevel = m.townhallLevel;
      row.warsIn += 1;
      const attacks = m.attacks ?? [];
      row.attacks += attacks.length;
      if (ended) row.missed += Math.max(0, (war.attacksPerMember ?? 1) - attacks.length);
      for (const a of attacks) {
        row.stars += a.stars;
        row.destructionSum += a.destructionPercentage;
        if (a.stars === 3) row.triples += 1;
      }
      if (m.bestOpponentAttack) {
        row.defenses += 1;
        row.starsConceded += m.bestOpponentAttack.stars;
      }
      rows.set(m.tag, row);
    }
  }
  return [...rows.values()]
    .map(({ destructionSum, ...r }) => ({
      ...r,
      avgStars: r.attacks ? r.stars / r.attacks : 0,
      avgDestruction: r.attacks ? destructionSum / r.attacks : 0,
    }))
    .sort((a, b) => b.stars - a.stars || b.avgDestruction - a.avgDestruction);
}

// ---------- Ranked league ----------

const TIER_BASE = 105_000_000;

export interface RankedAllowance {
  /** Legend I gets a daily allowance; every other tier a weekly one. */
  period: "day" | "week";
  attacks: number;
  /** Known for Legend I (8 per day); not published for weekly tiers. */
  defenses: number | null;
}

/**
 * Attacks per tournament by league tier id (105000001 Skeleton League 1 ...
 * 105000036 Legend I). The API doesn't expose these; they come from community
 * guides (cocdata.org, blueprintcoc.com, 2026), and Legend I's 8 + 8 per day
 * and Legend II's 30 per week were confirmed against live data on 2026-11-08.
 */
export function rankedAllowance(tierId: number | undefined): RankedAllowance | null {
  if (tierId == null) return null;
  const n = tierId - TIER_BASE;
  if (n === 36) return { period: "day", attacks: 8, defenses: 8 };
  const weekly = (attacks: number): RankedAllowance => ({ period: "week", attacks, defenses: null });
  if (n === 35) return weekly(30); // Legend II
  if (n === 34) return weekly(24); // Legend III
  if (n >= 31 && n <= 33) return weekly(24); // Electro
  if (n >= 28) return weekly(18); // Dragon
  if (n >= 25) return weekly(14); // Titan
  if (n >= 19) return weekly(12); // Golem, P.E.K.K.A
  if (n >= 13) return weekly(10); // Valkyrie, Witch
  if (n >= 7) return weekly(8); // Archer, Wizard
  if (n >= 1) return weekly(6); // Skeleton, Barbarian
  return null; // Unranked
}

const MATCH_WINDOW_MS = 10 * 60_000;

/**
 * Trophy change for each battle log entry, taken from the ranked group logs
 * (the battle log itself has no trophies). Matched on attack/defense, opponent,
 * stars and destruction within 10 minutes; each group log entry is used once.
 * Live data showed the two timestamps 0-4 minutes apart. Returns the trophies
 * the player earned (weekly tiers earn trophies on defense too), null when
 * there's no match (e.g. regular battles).
 */
export function rankedTrophiesForBattles(
  entries: BattleLogEntry[],
  attacks: RankedLogEntry[],
  defenses: RankedLogEntry[],
): (number | null)[] {
  const used = new Set<RankedLogEntry>();
  return entries.map((b) => {
    const when = parseApiTime(b.battleTimestamp)?.getTime();
    if (when == null) return null;
    let best: RankedLogEntry | null = null;
    let bestGap = Infinity;
    for (const e of b.attack ? attacks : defenses) {
      if (used.has(e) || e.opponentPlayerTag !== b.opponentPlayerTag) continue;
      if (e.stars !== b.stars || e.destructionPercentage !== b.destructionPercentage) continue;
      const gap = Math.abs(Date.parse(e.creationTime) - when);
      if (gap <= MATCH_WINDOW_MS && gap < bestGap) {
        best = e;
        bestGap = gap;
      }
    }
    if (!best) return null;
    used.add(best);
    return best.trophies;
  });
}

/**
 * Legend I trophies for one battle, from stars and destruction. The API
 * doesn't report them; this is the Legend League formula (3 stars: 40;
 * 2 stars: 16 + 1 per 3% above 50%; 1 star: 5 + 1 per 9% above 1%; 0 stars: 0).
 * Checked 2026-11-08 against a player tracked by clashspot: rebuilding two
 * full league days from it reproduced the tracked day start/end trophies
 * exactly. Still an estimate (the API rounds destruction). The attacker gains
 * this and the defender loses it.
 */
export function legendTrophies(stars: number, destruction: number): number {
  const pct = Math.max(0, Math.min(100, Math.floor(destruction)));
  if (stars >= 3) return 40;
  if (stars === 2) return Math.min(32, 16 + Math.floor(Math.max(0, pct - 50) / 3));
  if (stars === 1) return Math.min(15, 5 + Math.floor(Math.max(0, pct - 1) / 9));
  return 0;
}

export interface BattleLogSummary {
  attacks: number;
  defenses: number;
  /** Average stars per attack / conceded per defense. */
  avgAttackStars: number;
  avgDefenseStars: number;
  attackTriples: number;
  defenseTriples: number;
}

export function summarizeBattleLog(entries: BattleLogEntry[]): BattleLogSummary {
  const atk = entries.filter((e) => e.attack);
  const def = entries.filter((e) => !e.attack);
  const avg = (list: BattleLogEntry[]) => (list.length ? list.reduce((s, e) => s + e.stars, 0) / list.length : 0);
  return {
    attacks: atk.length,
    defenses: def.length,
    avgAttackStars: avg(atk),
    avgDefenseStars: avg(def),
    attackTriples: atk.filter((e) => e.stars === 3).length,
    defenseTriples: def.filter((e) => e.stars === 3).length,
  };
}

// ---------- Players ----------

export function donationRatio(donations: number, received: number): number | null {
  if (received === 0) return donations === 0 ? null : Infinity;
  return donations / received;
}

export interface UnitProgress {
  done: number;
  total: number;
  /** 0..1 share of total levels unlocked. */
  ratio: number;
  maxed: number;
  count: number;
}

export function unitProgress(units: PlayerUnit[]): UnitProgress {
  const done = units.reduce((s, u) => s + u.level, 0);
  const total = units.reduce((s, u) => s + u.maxLevel, 0);
  return {
    done,
    total,
    ratio: total ? done / total : 0,
    maxed: units.filter((u) => u.level >= u.maxLevel).length,
    count: units.length,
  };
}

/** Home-village units only; builder base and capital units are listed apart. */
export function byVillage(units: PlayerUnit[], village: "home" | "builderBase"): PlayerUnit[] {
  return units.filter((u) => u.village === village);
}
