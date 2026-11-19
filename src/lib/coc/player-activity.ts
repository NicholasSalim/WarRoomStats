// One player's part in their clan's wars and raid weekends. The API has no
// per-player war or raid history: it lives in the clan's current war, the
// current CWL season's wars and the recent raid weekends, so this picks the
// player out of those. Pure functions, no API calls.

import type { CapitalRaidSeason, War, WarClan, WarMember } from "./schemas";
import { endedWarOutcome, type WarOutcome } from "./war-outcome";

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

type Side = "clan" | "opponent";

function sides(war: War, playerTag: string): { side: Side; them: WarClan; me: WarMember } | null {
  for (const [side, other] of [
    ["clan", "opponent"],
    ["opponent", "clan"],
  ] as const) {
    const us = war[side];
    const them = war[other];
    const me = us?.members?.find((m) => m.tag === playerTag);
    if (us && them && me) return { side, them, me };
  }
  return null;
}

/** The player's attacks and defenses in one war, or null when they weren't in the line-up. */
export function playerWar(war: War, playerTag: string, label: string, cwl: boolean): PlayerWar | null {
  const found = sides(war, playerTag);
  if (!found) return null;
  const { side, them, me } = found;
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
    outcome: endedWarOutcome(war, side),
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
  /** Null when the player didn't raid that weekend (or wasn't in the clan yet). */
  attacks: number | null;
  attackLimit: number | null;
  /** Capital Gold looted. */
  looted: number | null;
  districtAttacks: RaidDistrictAttack[];
}

/**
 * The player's raid weekends. The API only keeps per-player raid data (the
 * member list, and who attacked each district) for the latest weekend; older
 * weekends have clan totals only (checked live 2026-11-10), so they're left out.
 */
export function playerRaids(seasons: CapitalRaidSeason[], playerTag: string): PlayerRaidWeekend[] {
  return seasons.flatMap((s) => {
    if (!s.members) return [];
    const me = s.members.find((m) => m.tag === playerTag);
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
    return [
      {
        startTime: s.startTime,
        state: s.state,
        attacks: me ? me.attacks : null,
        attackLimit: me ? me.attackLimit + (me.bonusAttackLimit ?? 0) : null,
        looted: me ? me.capitalResourcesLooted : null,
        districtAttacks,
      },
    ];
  });
}

export interface RaidRaider {
  tag: string;
  name: string;
  attacks: number;
  attackLimit: number;
  looted: number;
}

/** A weekend's raiders, most loot first. Empty for weekends without a member list (all but the latest). */
export function weekendRaiders(season: CapitalRaidSeason): RaidRaider[] {
  return (season.members ?? [])
    .map((m) => ({
      tag: m.tag,
      name: m.name,
      attacks: m.attacks,
      attackLimit: m.attackLimit + (m.bonusAttackLimit ?? 0),
      looted: m.capitalResourcesLooted,
    }))
    .sort((a, b) => b.looted - a.looted);
}
