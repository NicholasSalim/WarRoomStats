// One player's part in their clan's wars and raid weekends. The API has no
// per-player war or raid history: it lives in the clan's current war, the
// current CWL season's wars and the recent raid weekends, so this picks the
// player out of those. Pure functions, no API calls.

import type { CapitalRaidSeason, War, WarClan, WarMember } from "./schemas";
import { warOutcome, type WarOutcome } from "./stats";

export interface PlayerWarAttack {
  /** The other side's player: the defender for attacks, the attacker for defenses. */
  name: string;
  tag: string;
  townHall: number;
  position: number;
  stars: number;
  destruction: number;
  order: number;
}

export interface PlayerWar {
  label: string;
  state: string;
  /** War start (battle day) as the API's compact time, for sorting and display. */
  startTime?: string;
  endTime?: string;
  opponent: { tag?: string; name?: string; badge?: string };
  outcome: WarOutcome | null;
  position: number;
  townHall: number;
  attacksAllowed: number;
  attacks: PlayerWarAttack[];
  defenses: PlayerWarAttack[];
}

function sides(war: War, playerTag: string): { us: WarClan; them: WarClan; me: WarMember } | null {
  for (const [us, them] of [
    [war.clan, war.opponent],
    [war.opponent, war.clan],
  ] as const) {
    const me = us?.members?.find((m) => m.tag === playerTag);
    if (us && them && me) return { us, them, me };
  }
  return null;
}

/** The player's attacks and defenses in one war, or null when they weren't in the line-up. */
export function playerWar(war: War, playerTag: string, label: string, cwl: boolean): PlayerWar | null {
  const found = sides(war, playerTag);
  if (!found) return null;
  const { us, them, me } = found;
  const byTag = new Map((them.members ?? []).map((m) => [m.tag, m]));
  const attacks = (me.attacks ?? []).map((a) => {
    const d = byTag.get(a.defenderTag);
    return {
      name: d?.name ?? a.defenderTag,
      tag: a.defenderTag,
      townHall: d?.townhallLevel ?? 0,
      position: d?.mapPosition ?? 0,
      stars: a.stars,
      destruction: a.destructionPercentage,
      order: a.order,
    };
  });
  const defenses = (them.members ?? []).flatMap((m) =>
    (m.attacks ?? [])
      .filter((a) => a.defenderTag === playerTag)
      .map((a) => ({
        name: m.name,
        tag: m.tag,
        townHall: m.townhallLevel,
        position: m.mapPosition,
        stars: a.stars,
        destruction: a.destructionPercentage,
        order: a.order,
      })),
  );
  return {
    label,
    state: war.state,
    startTime: war.startTime,
    endTime: war.endTime,
    opponent: { tag: them.tag, name: them.name, badge: them.badgeUrls?.small },
    outcome: war.state === "warEnded" ? warOutcome(us, them) : null,
    position: me.mapPosition,
    townHall: me.townhallLevel,
    attacksAllowed: war.attacksPerMember ?? (cwl ? 1 : 2),
    attacks: attacks.sort((a, b) => a.order - b.order),
    defenses: defenses.sort((a, b) => a.order - b.order),
  };
}

export interface WarTotals {
  wars: number;
  attacks: number;
  attacksAllowed: number;
  stars: number;
  threeStars: number;
  avgDestruction: number;
  defenses: number;
  starsConceded: number;
}

export function warTotals(wars: PlayerWar[]): WarTotals {
  const attacks = wars.flatMap((w) => w.attacks);
  const defenses = wars.flatMap((w) => w.defenses);
  return {
    wars: wars.length,
    attacks: attacks.length,
    // Wars in preparation can't be attacked yet, so they don't count against the player.
    attacksAllowed: wars.filter((w) => w.state !== "preparation").reduce((n, w) => n + w.attacksAllowed, 0),
    stars: attacks.reduce((n, a) => n + a.stars, 0),
    threeStars: attacks.filter((a) => a.stars === 3).length,
    avgDestruction: attacks.length ? attacks.reduce((n, a) => n + a.destruction, 0) / attacks.length : 0,
    defenses: defenses.length,
    starsConceded: defenses.reduce((n, a) => n + a.stars, 0),
  };
}

export interface RaidDistrictAttack {
  clan: string;
  district: string;
  hallLevel: number;
  stars: number;
  destruction: number;
}

export interface PlayerRaidWeekend {
  startTime: string;
  state: string;
  /**
   * Whether the game kept per-player data for this weekend. It only does for
   * the latest weekend; older ones have clan totals only.
   */
  known: boolean;
  /** Null when the player didn't raid that weekend (or wasn't in the clan yet). */
  attacks: number | null;
  /** Attacks allowed; only known for weekends with a member list (the latest). */
  attackLimit: number | null;
  /** Capital Gold looted; only known for weekends with a member list (the latest). */
  looted: number | null;
  districtAttacks: RaidDistrictAttack[];
}

/**
 * The API only keeps per-player raid data (the member list, and who attacked
 * each district) for the latest raid weekend; older weekends have clan totals
 * only (checked live 2026-11-10). Weekends without a member list are marked
 * `known: false`; if they ever do list district attackers, attacks are counted
 * from those.
 */
export function playerRaids(seasons: CapitalRaidSeason[], playerTag: string): PlayerRaidWeekend[] {
  return seasons.map((s) => {
    const me = s.members?.find((m) => m.tag === playerTag);
    const districtAttacks = s.attackLog.flatMap((raid) =>
      raid.districts.flatMap((d) =>
        (d.attacks ?? [])
          .filter((a) => a.attacker.tag === playerTag)
          .map((a) => ({
            clan: raid.defender.name,
            district: d.name.replace(/\s+/g, " "),
            hallLevel: d.districtHallLevel,
            stars: a.stars ?? 0,
            destruction: a.destructionPercent,
          })),
      ),
    );
    if (s.members) {
      return {
        startTime: s.startTime,
        state: s.state,
        known: true,
        attacks: me ? me.attacks : null,
        attackLimit: me ? me.attackLimit + (me.bonusAttackLimit ?? 0) : null,
        looted: me ? me.capitalResourcesLooted : null,
        districtAttacks,
      };
    }
    return {
      startTime: s.startTime,
      state: s.state,
      known: false,
      attacks: districtAttacks.length > 0 ? districtAttacks.length : null,
      attackLimit: null,
      looted: null,
      districtAttacks,
    };
  });
}

export interface RaidRaider {
  tag: string;
  name: string;
  attacks: number;
  /** Null when the weekend has no member list (loot isn't known). */
  attackLimit: number | null;
  looted: number | null;
}

/**
 * A weekend's raiders: from the member list when the API includes it (the
 * latest weekend), otherwise rebuilt from the district attacks (attacks only).
 * Most loot first, or most attacks when loot isn't known.
 */
export function weekendRaiders(season: CapitalRaidSeason): RaidRaider[] {
  if (season.members) {
    return season.members
      .map((m) => ({
        tag: m.tag,
        name: m.name,
        attacks: m.attacks,
        attackLimit: m.attackLimit + (m.bonusAttackLimit ?? 0),
        looted: m.capitalResourcesLooted,
      }))
      .sort((a, b) => (b.looted ?? 0) - (a.looted ?? 0));
  }
  const byTag = new Map<string, RaidRaider>();
  for (const raid of season.attackLog) {
    for (const d of raid.districts) {
      for (const a of d.attacks ?? []) {
        const r = byTag.get(a.attacker.tag) ?? { tag: a.attacker.tag, name: a.attacker.name, attacks: 0, attackLimit: null, looted: null };
        r.attacks++;
        byTag.set(a.attacker.tag, r);
      }
    }
  }
  return [...byTag.values()].sort((a, b) => b.attacks - a.attacks || a.name.localeCompare(b.name));
}
