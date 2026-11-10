// zod schemas for the official Clash of Clans API responses we use.
// Kept deliberately lenient: optional fields stay optional and enum-like
// fields are plain strings, so a new upstream value doesn't break a page.

import { z } from "zod";

const IconUrls = z.object({
  tiny: z.string().optional(),
  small: z.string().optional(),
  medium: z.string().optional(),
  large: z.string().optional(),
});

const BadgeUrls = z.object({
  small: z.string().optional(),
  medium: z.string().optional(),
  large: z.string().optional(),
});

const NamedId = z.object({ id: z.number(), name: z.string() });

const League = NamedId.extend({ iconUrls: IconUrls.optional() });

export const LocationSchema = z.object({
  id: z.number(),
  name: z.string(),
  isCountry: z.boolean(),
  countryCode: z.string().optional(),
});

const Label = z.object({ id: z.number(), name: z.string(), iconUrls: IconUrls.optional() });

const Paging = z
  .object({
    cursors: z.object({ before: z.string().optional(), after: z.string().optional() }).optional(),
  })
  .optional();

// ---------- Clans ----------

export const ClanMemberSchema = z.object({
  tag: z.string(),
  name: z.string(),
  role: z.string(),
  townHallLevel: z.number().optional(),
  expLevel: z.number(),
  league: League.optional(),
  /** Ranked league tier (e.g. "Legend I"); replaced `league` in the 2025 league rework. */
  leagueTier: League.optional(),
  trophies: z.number(),
  builderBaseTrophies: z.number().optional(),
  builderBaseLeague: NamedId.optional(),
  clanRank: z.number(),
  previousClanRank: z.number().optional(),
  donations: z.number(),
  donationsReceived: z.number(),
});

export const ClanSchema = z.object({
  tag: z.string(),
  name: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
  location: LocationSchema.optional(),
  chatLanguage: z.object({ id: z.number(), name: z.string() }).optional(),
  isFamilyFriendly: z.boolean().optional(),
  badgeUrls: BadgeUrls,
  clanLevel: z.number(),
  clanPoints: z.number(),
  clanBuilderBasePoints: z.number().optional(),
  clanCapitalPoints: z.number().optional(),
  capitalLeague: NamedId.optional(),
  requiredTrophies: z.number().optional(),
  requiredTownhallLevel: z.number().optional(),
  requiredBuilderBaseTrophies: z.number().optional(),
  warFrequency: z.string().optional(),
  warWinStreak: z.number().optional(),
  warWins: z.number().optional(),
  warTies: z.number().optional(),
  warLosses: z.number().optional(),
  isWarLogPublic: z.boolean().optional(),
  warLeague: NamedId.optional(),
  members: z.number(),
  memberList: z.array(ClanMemberSchema).optional(),
  labels: z.array(Label).optional(),
  clanCapital: z
    .object({
      capitalHallLevel: z.number().optional(),
      districts: z.array(z.object({ id: z.number(), name: z.string(), districtHallLevel: z.number() })).optional(),
    })
    .optional(),
});

export const ClanSearchSchema = z.object({
  items: z.array(ClanSchema.omit({ memberList: true })),
  paging: Paging,
});

// ---------- Wars ----------

export const WarAttackSchema = z.object({
  attackerTag: z.string(),
  defenderTag: z.string(),
  stars: z.number(),
  destructionPercentage: z.number(),
  order: z.number(),
  duration: z.number().optional(),
});

export const WarMemberSchema = z.object({
  tag: z.string(),
  name: z.string(),
  townhallLevel: z.number(),
  mapPosition: z.number(),
  opponentAttacks: z.number().optional(),
  attacks: z.array(WarAttackSchema).optional(),
  bestOpponentAttack: WarAttackSchema.optional(),
});

export const WarClanSchema = z.object({
  tag: z.string().optional(),
  name: z.string().optional(),
  badgeUrls: BadgeUrls.optional(),
  clanLevel: z.number().optional(),
  attacks: z.number().optional(),
  stars: z.number().optional(),
  destructionPercentage: z.number().optional(),
  expEarned: z.number().optional(),
  members: z.array(WarMemberSchema).optional(),
});

export const WarSchema = z.object({
  state: z.string(),
  teamSize: z.number().optional(),
  attacksPerMember: z.number().optional(),
  battleModifier: z.string().optional(),
  preparationStartTime: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  warStartTime: z.string().optional(),
  clan: WarClanSchema.optional(),
  opponent: WarClanSchema.optional(),
});

export const WarLogEntrySchema = z.object({
  result: z.string().nullish(),
  endTime: z.string(),
  teamSize: z.number(),
  attacksPerMember: z.number().optional(),
  battleModifier: z.string().optional(),
  clan: WarClanSchema,
  opponent: WarClanSchema,
});

export const WarLogSchema = z.object({ items: z.array(WarLogEntrySchema), paging: Paging });

export const LeagueGroupSchema = z.object({
  state: z.string(),
  season: z.string().optional(),
  clans: z.array(
    z.object({
      tag: z.string(),
      name: z.string(),
      clanLevel: z.number().optional(),
      badgeUrls: BadgeUrls.optional(),
      members: z
        .array(z.object({ tag: z.string(), name: z.string(), townHallLevel: z.number().optional() }))
        .optional(),
    }),
  ),
  rounds: z.array(z.object({ warTags: z.array(z.string()) })),
});

// ---------- Capital raids ----------

const RaidClan = z.object({
  tag: z.string(),
  name: z.string(),
  level: z.number().optional(),
  badgeUrls: BadgeUrls.optional(),
});

const RaidDistrict = z.object({
  id: z.number(),
  name: z.string(),
  districtHallLevel: z.number(),
  destructionPercent: z.number(),
  stars: z.number().optional(),
  attackCount: z.number(),
  totalLooted: z.number().optional(),
  attacks: z
    .array(
      z.object({
        attacker: z.object({ tag: z.string(), name: z.string() }),
        destructionPercent: z.number(),
        stars: z.number().optional(),
      }),
    )
    .optional(),
});

/** One clan this clan raided (attackLog) or was raided by (defenseLog). */
const RaidLogFields = {
  attackCount: z.number(),
  districtCount: z.number(),
  districtsDestroyed: z.number(),
  districts: z.array(RaidDistrict).default([]),
};

export const CapitalRaidSeasonSchema = z.object({
  state: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  capitalTotalLoot: z.number(),
  raidsCompleted: z.number().optional(),
  totalAttacks: z.number().optional(),
  enemyDistrictsDestroyed: z.number().optional(),
  offensiveReward: z.number().optional(),
  defensiveReward: z.number().optional(),
  members: z
    .array(
      z.object({
        tag: z.string(),
        name: z.string(),
        attacks: z.number(),
        attackLimit: z.number(),
        bonusAttackLimit: z.number().optional(),
        capitalResourcesLooted: z.number(),
      }),
    )
    .optional(),
  attackLog: z.array(z.object({ defender: RaidClan, ...RaidLogFields })).default([]),
  defenseLog: z.array(z.object({ attacker: RaidClan, ...RaidLogFields })).default([]),
});

export const CapitalRaidSeasonsSchema = z.object({
  items: z.array(CapitalRaidSeasonSchema),
  paging: Paging,
});

// ---------- Players ----------

const Unit = z.object({
  name: z.string(),
  level: z.number(),
  maxLevel: z.number(),
  village: z.string(),
  superTroopIsActive: z.boolean().optional(),
});

const LegendSeason = z.object({
  id: z.string().optional(),
  rank: z.number().optional(),
  trophies: z.number(),
});

export const PlayerSchema = z.object({
  tag: z.string(),
  name: z.string(),
  townHallLevel: z.number(),
  townHallWeaponLevel: z.number().optional(),
  expLevel: z.number(),
  trophies: z.number(),
  bestTrophies: z.number(),
  warStars: z.number(),
  attackWins: z.number(),
  defenseWins: z.number(),
  builderHallLevel: z.number().optional(),
  builderBaseTrophies: z.number().optional(),
  bestBuilderBaseTrophies: z.number().optional(),
  role: z.string().optional(),
  warPreference: z.string().optional(),
  donations: z.number(),
  donationsReceived: z.number(),
  clanCapitalContributions: z.number().optional(),
  clan: z
    .object({
      tag: z.string(),
      name: z.string(),
      clanLevel: z.number().optional(),
      badgeUrls: BadgeUrls.optional(),
    })
    .optional(),
  league: League.optional(),
  /** Ranked league tier (e.g. "Legend I"); replaced `league` in the 2025 league rework. */
  leagueTier: League.optional(),
  /** Ranked league group and weekly season ("#0" when the player has no group, e.g. Legend). */
  currentLeagueGroupTag: z.string().optional(),
  currentLeagueSeasonId: z.number().optional(),
  previousLeagueGroupTag: z.string().optional(),
  previousLeagueSeasonId: z.number().optional(),
  builderBaseLeague: NamedId.optional(),
  legendStatistics: z
    .object({
      legendTrophies: z.number().optional(),
      currentSeason: LegendSeason.optional(),
      previousSeason: LegendSeason.optional(),
      bestSeason: LegendSeason.optional(),
    })
    .optional(),
  achievements: z
    .array(
      z.object({
        name: z.string(),
        stars: z.number(),
        value: z.number(),
        target: z.number(),
        info: z.string().optional(),
        completionInfo: z.string().nullish(),
        village: z.string(),
      }),
    )
    .default([]),
  labels: z.array(Label).optional(),
  troops: z.array(Unit).default([]),
  heroes: z.array(Unit).default([]),
  heroEquipment: z.array(Unit).default([]),
  spells: z.array(Unit).default([]),
});

// ---------- Battle log and ranked league ----------

/** One entry of /players/{tag}/battlelog (the last ~40-50 battles, a few days). */
export const BattleLogEntrySchema = z.object({
  /** "ranked", "legend", "homeVillage", ... */
  battleType: z.string(),
  attack: z.boolean(),
  armyShareCode: z.string().optional(),
  opponentPlayerTag: z.string(),
  opponentName: z.string(),
  opponentTownHallLevel: z.number().optional(),
  stars: z.number(),
  destructionPercentage: z.number(),
  lootedResources: z.array(z.object({ name: z.string(), amount: z.number() })).optional(),
  /** Battle duration in seconds. */
  battleTime: z.number().optional(),
  /** When the battle happened, compact API format. */
  battleTimestamp: z.string(),
});

export const BattleLogSchema = z.object({ items: z.array(BattleLogEntrySchema) });

/** Attack or defense in a ranked league group; `trophies` won (attack) or lost (defense). */
export const RankedLogEntrySchema = z.object({
  opponentPlayerTag: z.string(),
  opponentName: z.string(),
  stars: z.number(),
  destructionPercentage: z.number(),
  trophies: z.number(),
  /** ISO 8601, e.g. "2026-11-03T00:06:36Z". */
  creationTime: z.string(),
});

/** /leaguegroup/{groupTag}/{seasonId}?playerTag=... : a weekly ranked group, members sorted by trophies. */
export const RankedGroupSchema = z.object({
  members: z.array(
    z.object({
      playerTag: z.string(),
      playerName: z.string(),
      clanTag: z.string().optional(),
      clanName: z.string().optional(),
      leagueTrophies: z.number(),
      attackWinCount: z.number().optional(),
      attackLoseCount: z.number().optional(),
      defenseWinCount: z.number().optional(),
      defenseLoseCount: z.number().optional(),
    }),
  ),
  attackLogs: z.array(RankedLogEntrySchema).default([]),
  defenseLogs: z.array(RankedLogEntrySchema).default([]),
});

/** One finished season from /players/{tag}/leaguehistory. */
export const LeagueSeasonResultSchema = z.object({
  /** Season start as Unix seconds. */
  leagueSeasonId: z.number(),
  leagueTrophies: z.number().optional(),
  leagueTierId: z.number().optional(),
  placement: z.number().optional(),
  attackWins: z.number().optional(),
  attackLosses: z.number().optional(),
  attackStars: z.number().optional(),
  defenseWins: z.number().optional(),
  defenseLosses: z.number().optional(),
  defenseStars: z.number().optional(),
  maxBattles: z.number().optional(),
});

export const LeagueHistorySchema = z.object({ items: z.array(LeagueSeasonResultSchema) });

export const LeagueTierSchema = League;
export const LeagueTiersSchema = z.object({ items: z.array(LeagueTierSchema) });

// ---------- Locations and rankings ----------

export const LocationsSchema = z.object({ items: z.array(LocationSchema), paging: Paging });

export const PlayerRankingSchema = z.object({
  tag: z.string(),
  name: z.string(),
  expLevel: z.number().optional(),
  trophies: z.number(),
  attackWins: z.number().optional(),
  defenseWins: z.number().optional(),
  rank: z.number(),
  previousRank: z.number().optional(),
  clan: z
    .object({ tag: z.string(), name: z.string(), badgeUrls: BadgeUrls.optional() })
    .optional(),
  league: League.optional(),
  leagueTier: League.optional(),
});

export const ClanRankingSchema = z.object({
  tag: z.string(),
  name: z.string(),
  location: LocationSchema.optional(),
  badgeUrls: BadgeUrls.optional(),
  clanLevel: z.number(),
  members: z.number(),
  clanPoints: z.number(),
  rank: z.number(),
  previousRank: z.number().optional(),
});

export const PlayerRankingsSchema = z.object({ items: z.array(PlayerRankingSchema), paging: Paging });
export const ClanRankingsSchema = z.object({ items: z.array(ClanRankingSchema), paging: Paging });

const RankedClanBase = z.object({
  tag: z.string(),
  name: z.string(),
  location: LocationSchema.optional(),
  badgeUrls: BadgeUrls.optional(),
  clanLevel: z.number(),
  members: z.number(),
  rank: z.number(),
  previousRank: z.number().optional(),
});
export const CapitalRankingsSchema = z.object({
  items: z.array(RankedClanBase.extend({ clanCapitalPoints: z.number() })),
  paging: Paging,
});
export const BuilderBaseClanRankingsSchema = z.object({
  items: z.array(RankedClanBase.extend({ clanBuilderBasePoints: z.number() })),
  paging: Paging,
});
export const BuilderBasePlayerRankingsSchema = z.object({
  items: z.array(
    PlayerRankingSchema.omit({ trophies: true }).extend({
      builderBaseTrophies: z.number(),
      builderBaseLeague: NamedId.optional(),
    }),
  ),
  paging: Paging,
});

export const LabelsSchema = z.object({ items: z.array(Label), paging: Paging });

export const GoldPassSeasonSchema = z.object({ startTime: z.string(), endTime: z.string() });

/** /leagues/{id}/seasons: ids of finished Legend seasons, oldest first. */
export const LegendSeasonsSchema = z.object({ items: z.array(z.object({ id: z.string() })), paging: Paging });

// ---------- Types ----------

export type Clan = z.infer<typeof ClanSchema>;
export type ClanMember = z.infer<typeof ClanMemberSchema>;
export type ClanSearchResult = z.infer<typeof ClanSearchSchema>;
export type War = z.infer<typeof WarSchema>;
export type WarClan = z.infer<typeof WarClanSchema>;
export type WarMember = z.infer<typeof WarMemberSchema>;
export type WarAttack = z.infer<typeof WarAttackSchema>;
export type WarLog = z.infer<typeof WarLogSchema>;
export type WarLogEntry = z.infer<typeof WarLogEntrySchema>;
export type LeagueGroup = z.infer<typeof LeagueGroupSchema>;
export type CapitalRaidSeason = z.infer<typeof CapitalRaidSeasonSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type BattleLogEntry = z.infer<typeof BattleLogEntrySchema>;
export type RankedLogEntry = z.infer<typeof RankedLogEntrySchema>;
export type RankedGroup = z.infer<typeof RankedGroupSchema>;
export type LeagueSeasonResult = z.infer<typeof LeagueSeasonResultSchema>;
export type LeagueTier = z.infer<typeof LeagueTierSchema>;
export type PlayerUnit = z.infer<typeof Unit>;
export type Location = z.infer<typeof LocationSchema>;
export type PlayerRanking = z.infer<typeof PlayerRankingSchema>;
export type ClanRanking = z.infer<typeof ClanRankingSchema>;
export type Label = z.infer<typeof Label>;
export type GoldPassSeason = z.infer<typeof GoldPassSeasonSchema>;
export type RaidDistrict = z.infer<typeof RaidDistrict>;
