// Generates deterministic CoC API fixtures into src/lib/coc/fixtures/.
// They follow the official API's response shapes and drive unit tests and
// COC_API_MOCK=1 dev mode. Run: node scripts/generate-fixtures.mjs
// Names, tags and numbers are made up.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "..", "src", "lib", "coc", "fixtures");
mkdirSync(OUT, { recursive: true });

let seed = 20261107;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const TAG_CHARS = "0289PYLQGRJCUV";
const makeTag = (len = 9) => "#" + Array.from({ length: len }, () => pick(TAG_CHARS.split(""))).join("");

const BADGE = { small: "/mock-badge.svg", medium: "/mock-badge.svg", large: "/mock-badge.svg" };
const ICON = { tiny: "/mock-badge.svg", small: "/mock-badge.svg", medium: "/mock-badge.svg" };
const apiTime = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, ".$1Z");

const LEAGUES = [
  { id: 29000022, name: "Legend League" },
  { id: 29000021, name: "Titan League I" },
  { id: 29000018, name: "Champion League I" },
  { id: 29000015, name: "Master League I" },
  { id: 29000012, name: "Crystal League I" },
];
const FIRST = ["Ash", "Brook", "Cinder", "Dusk", "Ember", "Frost", "Gale", "Haze", "Iris", "Jade", "Kite", "Lark", "Moss", "Nova", "Onyx", "Pike", "Quill", "Rune", "Sage", "Tide", "Umber", "Vale", "Wren", "Yarrow", "Zephyr"];
const SECOND = ["fall", "wood", "wing", "stone", "brand", "song", "light", "storm", "crest", "shade"];
const names = new Set();
const personName = () => {
  let n;
  do n = pick(FIRST) + pick(SECOND) + (rand() < 0.3 ? int(1, 99) : "");
  while (names.has(n));
  names.add(n);
  return n;
};

const CLAN_TAG = "#2PRGP0L22";
const CLAN_NAME = "Night Owls";
const ROLES = ["leader", ...Array(3).fill("coLeader"), ...Array(6).fill("admin"), ...Array(20).fill("member")];

// ---------- clan + members ----------
const members = Array.from({ length: 30 }, (_, i) => {
  const th = int(11, 17);
  const trophies = int(2200, 5600);
  const league = trophies > 5000 ? LEAGUES[0] : trophies > 4100 ? LEAGUES[1] : trophies > 3200 ? LEAGUES[2] : trophies > 2600 ? LEAGUES[3] : LEAGUES[4];
  return {
    tag: makeTag(),
    name: personName(),
    role: ROLES[i],
    townHallLevel: th,
    expLevel: int(120, 280),
    league: { ...league, iconUrls: ICON },
    trophies,
    builderBaseTrophies: int(2000, 5000),
    clanRank: 0,
    previousClanRank: 0,
    donations: int(0, 3000),
    donationsReceived: int(0, 2500),
  };
})
  .sort((a, b) => b.trophies - a.trophies)
  .map((m, i) => ({ ...m, clanRank: i + 1, previousClanRank: Math.max(1, i + 1 + int(-2, 2)) }));

const clan = {
  tag: CLAN_TAG,
  name: CLAN_NAME,
  type: "inviteOnly",
  description: "Active war clan. Two attacks every war, donate what you get. Weekend raids are mandatory.",
  location: { id: 32000006, name: "International", isCountry: false },
  chatLanguage: { id: 75000000, name: "English" },
  isFamilyFriendly: true,
  badgeUrls: BADGE,
  clanLevel: 24,
  clanPoints: 48210,
  clanBuilderBasePoints: 41022,
  clanCapitalPoints: 3610,
  capitalLeague: { id: 85000015, name: "Master League II" },
  requiredTrophies: 2600,
  requiredTownhallLevel: 12,
  warFrequency: "always",
  warWinStreak: 4,
  warWins: 612,
  warTies: 21,
  warLosses: 188,
  isWarLogPublic: true,
  warLeague: { id: 48000015, name: "Champion League II" },
  members: members.length,
  memberList: members,
  labels: [
    { id: 56000000, name: "Clan Wars", iconUrls: ICON },
    { id: 56000004, name: "Clan Capital", iconUrls: ICON },
  ],
  clanCapital: { capitalHallLevel: 9 },
};

// ---------- wars ----------
function warSide(tag, name, size, attacksPerMember, roster) {
  const ms = Array.from({ length: size }, (_, i) => {
    const src = roster?.[i];
    return {
      tag: src?.tag ?? makeTag(),
      name: src?.name ?? personName(),
      townhallLevel: src?.townHallLevel ?? Math.max(11, 17 - Math.floor(i / 3) - int(0, 1)),
      mapPosition: i + 1,
      opponentAttacks: 0,
    };
  });
  return { tag, name, badgeUrls: BADGE, clanLevel: int(12, 28), attacks: 0, stars: 0, destructionPercentage: 0, members: ms, _apm: attacksPerMember };
}

function playWar(a, b, apm, progress) {
  let order = 1;
  const best = new Map(); // defenderTag -> {stars, pct}
  const attacks = [];
  for (const [att, def] of [[a, b], [b, a]]) {
    for (const m of att.members) {
      const n = rand() < progress ? apm : rand() < 0.5 ? apm - 1 : 0;
      for (let k = 0; k < n; k++) {
        const target = def.members[Math.min(def.members.length - 1, Math.max(0, m.mapPosition - 1 + int(-2, 2)))];
        const diff = m.townhallLevel - target.townhallLevel;
        const stars = Math.max(0, Math.min(3, int(1, 3) + (diff > 0 ? 1 : diff < 0 ? -1 : 0)));
        const pct = stars === 3 ? 100 : stars === 2 ? int(50, 99) : stars === 1 ? int(30, 70) : int(0, 49);
        const atk = { attackerTag: m.tag, defenderTag: target.tag, stars, destructionPercentage: pct, order: 0, duration: int(60, 180) };
        attacks.push({ atk, m, target, side: att });
      }
    }
  }
  attacks.sort(() => rand() - 0.5).forEach((x) => (x.atk.order = order++));
  for (const { atk, m, target, side } of attacks) {
    (m.attacks ??= []).push(atk);
    target.opponentAttacks += 1;
    const prev = target.bestOpponentAttack;
    if (!prev || atk.stars > prev.stars || (atk.stars === prev.stars && atk.destructionPercentage > prev.destructionPercentage)) target.bestOpponentAttack = atk;
    side.attacks += 1;
    const key = target.tag;
    const cur = best.get(key) ?? { stars: 0, pct: 0 };
    best.set(key, { stars: Math.max(cur.stars, atk.stars), pct: Math.max(cur.pct, atk.destructionPercentage) });
  }
  for (const [side, other] of [[a, b], [b, a]]) {
    let stars = 0, pct = 0;
    for (const t of other.members) {
      const r = best.get(t.tag);
      if (r) { stars += r.stars; pct += r.pct; }
    }
    side.stars = stars;
    side.destructionPercentage = Math.round((pct / other.members.length) * 100) / 100;
    delete side._apm;
  }
}

const now = new Date("2026-11-07T12:00:00Z");
const hours = (h) => new Date(now.getTime() + h * 3600_000);

const ourRoster = [...members].sort((x, y) => y.townHallLevel - x.townHallLevel);
const cw = { a: warSide(CLAN_TAG, CLAN_NAME, 15, 2, ourRoster), b: warSide(makeTag(), "Iron Lanterns", 15, 2) };
playWar(cw.a, cw.b, 2, 0.55);
const currentWar = {
  state: "inWar",
  teamSize: 15,
  attacksPerMember: 2,
  battleModifier: "none",
  preparationStartTime: apiTime(hours(-30)),
  startTime: apiTime(hours(-6)),
  endTime: apiTime(hours(18)),
  clan: cw.a,
  opponent: cw.b,
};

// ---------- war log ----------
const opponentNames = ["Iron Lanterns", "Salt & Ember", "The Quiet Ones", "Copper Kites", "Moonhollow", "Grey Harbor", "Velvet Storm", "Northbound", "Paper Tigers", "Static Bloom", "Red Thread", "Last Light"];
const warLog = {
  items: Array.from({ length: 14 }, (_, i) => {
    const end = hours(-48 * (i + 1) - 24);
    if (i === 3) {
      return {
        result: null,
        endTime: apiTime(end),
        teamSize: 15,
        attacksPerMember: 1,
        clan: { tag: CLAN_TAG, name: CLAN_NAME, badgeUrls: BADGE, clanLevel: 24, attacks: 98, stars: 280, destructionPercentage: 89.5, expEarned: 0 },
        opponent: { badgeUrls: {}, clanLevel: 0, stars: 0, destructionPercentage: 0 },
      };
    }
    const size = pick([15, 15, 20, 25, 30]);
    const ours = int(Math.floor(size * 1.6), size * 3);
    const theirs = int(Math.floor(size * 1.4), size * 3);
    const ourPct = Math.round(Math.min(100, (ours / (size * 3)) * 100 + int(-5, 8)) * 100) / 100;
    const theirPct = Math.round(Math.min(100, (theirs / (size * 3)) * 100 + int(-5, 8)) * 100) / 100;
    const result = ours > theirs ? "win" : ours < theirs ? "lose" : ourPct > theirPct ? "win" : ourPct < theirPct ? "lose" : "tie";
    return {
      result,
      endTime: apiTime(end),
      teamSize: size,
      attacksPerMember: 2,
      battleModifier: "none",
      clan: { tag: CLAN_TAG, name: CLAN_NAME, badgeUrls: BADGE, clanLevel: 24, attacks: int(size, size * 2), stars: ours, destructionPercentage: ourPct, expEarned: int(200, 600) },
      opponent: { tag: makeTag(), name: opponentNames[i % opponentNames.length], badgeUrls: BADGE, clanLevel: int(10, 30), stars: theirs, destructionPercentage: theirPct },
    };
  }),
  paging: { cursors: {} },
};

// ---------- CWL ----------
const groupClans = [{ tag: CLAN_TAG, name: CLAN_NAME, roster: ourRoster }];
for (const n of ["Copper Kites", "Moonhollow", "Grey Harbor", "Velvet Storm", "Northbound", "Static Bloom", "Red Thread"]) {
  groupClans.push({ tag: makeTag(), name: n, roster: null });
}
const rosters = new Map();
for (const c of groupClans) {
  rosters.set(c.tag, warSide(c.tag, c.name, 15, 1, c.roster).members.map(({ tag, name, townhallLevel }) => ({ tag, name, townhallLevel })));
}
const leagueGroup = {
  state: "inWar",
  season: "2026-11",
  clans: groupClans.map((c) => ({
    tag: c.tag,
    name: c.name,
    clanLevel: int(14, 28),
    badgeUrls: BADGE,
    members: rosters.get(c.tag).map((m) => ({ tag: m.tag, name: m.name, townHallLevel: m.townhallLevel })),
  })),
  rounds: [],
};
const cwlWars = {};
// Round-robin pairings (circle method).
const idx = groupClans.map((_, i) => i);
for (let r = 0; r < 7; r++) {
  const warTags = [];
  for (let p = 0; p < 4; p++) {
    const a = groupClans[idx[p]], b = groupClans[idx[7 - p]];
    if (r >= 3) { warTags.push("#0"); continue; }
    const warTag = makeTag(10);
    warTags.push(warTag);
    const sideA = warSide(a.tag, a.name, 15, 1, rosters.get(a.tag).map((m) => ({ ...m, townHallLevel: m.townhallLevel })));
    const sideB = warSide(b.tag, b.name, 15, 1, rosters.get(b.tag).map((m) => ({ ...m, townHallLevel: m.townhallLevel })));
    const live = r === 2;
    playWar(sideA, sideB, 1, live ? 0.5 : 0.92);
    const start = hours(-24 * (2 - r) - (live ? 5 : 0));
    cwlWars[warTag] = {
      state: live ? "inWar" : "warEnded",
      teamSize: 15,
      attacksPerMember: 1,
      preparationStartTime: apiTime(new Date(start.getTime() - 23 * 3600_000)),
      startTime: apiTime(start),
      endTime: apiTime(new Date(start.getTime() + 24 * 3600_000)),
      warStartTime: apiTime(start),
      clan: sideA,
      opponent: sideB,
    };
  }
  leagueGroup.rounds.push({ warTags });
  idx.splice(1, 0, idx.pop());
}

// ---------- capital raids ----------
const capitalRaids = {
  items: Array.from({ length: 4 }, (_, i) => {
    const start = new Date(Date.UTC(2026, 10, 6 - 7 * i, 7));
    const raiders = members.slice(0, int(20, 30));
    const ms = raiders.map((m) => {
      const attacks = int(1, 6);
      return { tag: m.tag, name: m.name, attacks, attackLimit: 5, bonusAttackLimit: attacks > 5 ? 1 : 0, capitalResourcesLooted: attacks * int(2500, 4800) };
    });
    return {
      state: i === 0 ? "ongoing" : "ended",
      startTime: apiTime(start),
      endTime: apiTime(new Date(start.getTime() + 3 * 86400_000)),
      capitalTotalLoot: ms.reduce((s, m) => s + m.capitalResourcesLooted, 0),
      raidsCompleted: int(4, 7),
      totalAttacks: ms.reduce((s, m) => s + m.attacks, 0),
      enemyDistrictsDestroyed: int(30, 52),
      offensiveReward: i === 0 ? 0 : int(900, 1400),
      defensiveReward: i === 0 ? 0 : int(150, 400),
      members: ms,
    };
  }),
  paging: { cursors: {} },
};

// ---------- player ----------
const me = members[0];
const troop = (name, level, maxLevel, village = "home") => ({ name, level, maxLevel, village });
const player = {
  tag: me.tag,
  name: me.name,
  townHallLevel: 16,
  townHallWeaponLevel: undefined,
  expLevel: 251,
  trophies: 5412,
  bestTrophies: 5890,
  warStars: 2140,
  attackWins: 87,
  defenseWins: 4,
  builderHallLevel: 10,
  builderBaseTrophies: 4630,
  bestBuilderBaseTrophies: 5011,
  role: "leader",
  warPreference: "in",
  donations: me.donations,
  donationsReceived: me.donationsReceived,
  clanCapitalContributions: 1843200,
  clan: { tag: CLAN_TAG, name: CLAN_NAME, clanLevel: 24, badgeUrls: BADGE },
  league: { ...LEAGUES[0], iconUrls: ICON },
  builderBaseLeague: { id: 44000036, name: "Emerald League III" },
  // Ranked league (2025 rework): tier + weekly group, as on the live API.
  leagueTier: { id: 105000026, name: "Titan II", iconUrls: { small: "/mock-badge.svg", large: "/mock-badge.svg" } },
  currentLeagueGroupTag: "#2QYLPR9",
  currentLeagueSeasonId: Date.UTC(2026, 10, 2, 5) / 1000,
  previousLeagueGroupTag: "#2QYLPR8",
  previousLeagueSeasonId: Date.UTC(2026, 9, 26, 5) / 1000,
  achievements: [
    { name: "Bigger Coffers", stars: 3, value: 16, target: 10, info: "Upgrade a Gold Storage to level 10", completionInfo: "Highest Gold Storage level: 16", village: "home" },
    { name: "Gold Grab", stars: 3, value: 2000000000, target: 100000000, info: "Steal 100000000 gold", completionInfo: "Total Gold looted: 2000000000", village: "home" },
    { name: "War Hero", stars: 3, value: 2140, target: 1000, info: "Score 1000 stars for your clan in Clan War battles", completionInfo: "Total stars scored for clan in Clan War battles: 2140", village: "home" },
    { name: "Friend in Need", stars: 3, value: 182340, target: 25000, info: "Donate 25000 capacity worth of reinforcements to Clanmates", completionInfo: "Total capacity donated: 182340", village: "home" },
    { name: "Sweet Victory!", stars: 3, value: 5890, target: 1250, info: "Achieve a total of 1250 trophies in Multiplayer battles", completionInfo: "Trophy record: 5890", village: "home" },
    { name: "War League Legend", stars: 2, value: 1120, target: 1500, info: "Score 1500 stars in Clan War League", completionInfo: null, village: "home" },
    { name: "Aggressive Capitalism", stars: 2, value: 18432000, target: 50000000, info: "Loot 50000000 Capital Gold during Raid attacks", completionInfo: null, village: "clanCapital" },
    { name: "Master Builder", stars: 3, value: 5011, target: 3000, info: "Achieve a total of 3000 trophies in Builder Base battles", completionInfo: "Trophy record: 5011", village: "builderBase" },
  ],
  labels: [{ id: 57000000, name: "Clan Wars", iconUrls: ICON }],
  troops: [
    troop("Barbarian", 12, 12), troop("Archer", 12, 12), troop("Giant", 12, 13), troop("Goblin", 9, 9),
    troop("Wall Breaker", 12, 13), troop("Balloon", 11, 11), troop("Wizard", 12, 12), troop("Healer", 9, 9),
    troop("Dragon", 11, 12), troop("P.E.K.K.A", 11, 11), troop("Baby Dragon", 9, 10), troop("Miner", 10, 10),
    troop("Electro Dragon", 7, 8), troop("Yeti", 6, 6), troop("Dragon Rider", 4, 4), troop("Electro Titan", 3, 4),
    troop("Root Rider", 2, 3), troop("Minion", 12, 12), troop("Hog Rider", 13, 13), troop("Valkyrie", 10, 11),
    troop("Golem", 13, 13), troop("Witch", 7, 7), troop("Lava Hound", 6, 6), troop("Bowler", 8, 8),
    troop("Ice Golem", 7, 8), troop("Headhunter", 3, 3), troop("Apprentice Warden", 3, 4),
    troop("Wall Wrecker", 5, 5), troop("Battle Blimp", 4, 4), troop("Stone Slammer", 5, 5), troop("Siege Barracks", 5, 5), troop("Log Launcher", 5, 5), troop("Flame Flinger", 4, 5),
    troop("L.A.S.S.I", 15, 15), troop("Electro Owl", 10, 15), troop("Mighty Yak", 15, 15), troop("Unicorn", 8, 10),
    troop("Raged Barbarian", 20, 20, "builderBase"), troop("Sneaky Archer", 18, 20, "builderBase"), troop("Boxer Giant", 20, 20, "builderBase"), troop("Beta Minion", 18, 20, "builderBase"),
  ],
  heroes: [
    troop("Barbarian King", 95, 100), troop("Archer Queen", 96, 100), troop("Grand Warden", 70, 75), troop("Royal Champion", 45, 50), troop("Minion Prince", 70, 80),
    troop("Battle Machine", 35, 35, "builderBase"), troop("Battle Copter", 30, 35, "builderBase"),
  ],
  heroEquipment: [
    troop("Giant Gauntlet", 24, 27), troop("Spiky Ball", 21, 27), troop("Frozen Arrow", 24, 27), troop("Magic Mirror", 18, 27),
    troop("Eternal Tome", 18, 18), troop("Rage Gem", 15, 18), troop("Fireball", 21, 27), troop("Rocket Spear", 18, 27),
  ],
  spells: [
    troop("Lightning Spell", 11, 12), troop("Healing Spell", 10, 11), troop("Rage Spell", 6, 6), troop("Jump Spell", 5, 5),
    troop("Freeze Spell", 7, 7), troop("Clone Spell", 8, 8), troop("Invisibility Spell", 4, 4), troop("Recall Spell", 5, 5),
    troop("Poison Spell", 10, 10), troop("Earthquake Spell", 5, 5), troop("Haste Spell", 5, 5), troop("Skeleton Spell", 8, 8), troop("Bat Spell", 6, 6),
  ],
};

// ---------- locations and rankings ----------
const locations = {
  items: [
    { id: 32000000, name: "Europe", isCountry: false },
    { id: 32000001, name: "North America", isCountry: false },
    { id: 32000006, name: "International", isCountry: false },
    { id: 32000022, name: "Australia", isCountry: true, countryCode: "AU" },
    { id: 32000038, name: "Brazil", isCountry: true, countryCode: "BR" },
    { id: 32000094, name: "Germany", isCountry: true, countryCode: "DE" },
    { id: 32000113, name: "India", isCountry: true, countryCode: "IN" },
    { id: 32000114, name: "Indonesia", isCountry: true, countryCode: "ID" },
    { id: 32000122, name: "Japan", isCountry: true, countryCode: "JP" },
    { id: 32000249, name: "United States", isCountry: true, countryCode: "US" },
  ],
  paging: { cursors: {} },
};
const playerRankings = {
  items: Array.from({ length: 50 }, (_, i) => ({
    tag: makeTag(),
    name: personName(),
    expLevel: int(200, 500),
    trophies: 6600 - i * int(3, 9),
    attackWins: int(40, 300),
    defenseWins: int(0, 20),
    rank: i + 1,
    previousRank: Math.max(1, i + 1 + int(-4, 4)),
    clan: rand() < 0.9 ? { tag: makeTag(), name: pick(opponentNames), badgeUrls: BADGE } : undefined,
    league: { ...LEAGUES[0], iconUrls: ICON },
  })),
  paging: { cursors: {} },
};
const clanRankings = {
  items: Array.from({ length: 50 }, (_, i) => ({
    tag: makeTag(),
    name: pick(opponentNames) + (i > 11 ? ` ${int(2, 9)}` : ""),
    location: pick(locations.items),
    badgeUrls: BADGE,
    clanLevel: int(25, 40),
    members: int(46, 50),
    clanPoints: 62000 - i * int(40, 110),
    rank: i + 1,
    previousRank: Math.max(1, i + 1 + int(-3, 3)),
  })),
  paging: { cursors: {} },
};
const clanSearch = {
  items: Array.from({ length: 12 }, (_, i) => {
    const rest = { ...clan };
    delete rest.memberList;
    return i === 0
      ? rest
      : { ...rest, tag: makeTag(), name: `${CLAN_NAME} ${["II", "III", "Academy", "Reborn", "Elite", "FWA", "Farm", "Legends", "Juniors", "Classic", "Asia"][i - 1]}`, clanLevel: int(3, 26), members: int(8, 50), clanPoints: int(9000, 47000), warLeague: { id: 48000010, name: "Gold League I" }, isWarLogPublic: rand() < 0.7 };
  }),
  paging: { cursors: {} },
};

// ---------- battle log, ranked group, league history, tiers ----------
// Generated last so the fixtures above keep their random sequence.
const compact = (d) => d.toISOString().replace(/[-:]/g, "");
const battleLog = {
  // Oldest first, like the live API.
  items: Array.from({ length: 40 }, (_, i) => {
    const attack = rand() < 0.5;
    const stars = int(0, 3);
    return {
      battleType: pick(["ranked", "ranked", "ranked", "homeVillage"]),
      attack,
      armyShareCode: "h4p10e40_13-7e52_53u94x55",
      opponentPlayerTag: makeTag(),
      opponentName: personName(),
      opponentTownHallLevel: int(14, 17),
      stars,
      destructionPercentage: stars === 3 ? 100 : int(20, 99),
      lootedResources: [
        { name: "Gold", amount: int(0, 900000) },
        { name: "Elixir", amount: int(0, 900000) },
        { name: "DarkElixir", amount: int(0, 9000) },
      ],
      battleTime: int(20, 180),
      battleTimestamp: compact(new Date(now.getTime() - (40 - i) * int(50, 110) * 60_000)),
    };
  }),
};

const seasonStart = player.currentLeagueSeasonId * 1000;
const rankedEntry = (dayIndex) => {
  const stars = int(0, 3);
  return {
    opponentPlayerTag: makeTag(),
    opponentName: personName(),
    stars,
    destructionPercentage: stars === 3 ? 100 : int(30, 99),
    trophies: stars === 0 ? int(0, 5) : int(5, 40),
    creationTime: new Date(seasonStart + dayIndex * 86_400_000 + int(1, 23) * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
};
const rankedGroup = {
  members: Array.from({ length: 100 }, (_, i) => ({
    playerTag: i === 37 ? player.tag : makeTag(),
    playerName: i === 37 ? player.name : personName(),
    clanTag: makeTag(),
    clanName: pick(opponentNames),
    leagueTrophies: 1600 - i * int(5, 12),
    attackWinCount: int(10, 30),
    attackLoseCount: int(0, 5),
    defenseWinCount: int(0, 5),
    defenseLoseCount: int(5, 25),
  })).sort((a, b) => b.leagueTrophies - a.leagueTrophies),
  // Five days into the season, 6 attacks and ~4 defenses per day.
  attackLogs: Array.from({ length: 30 }, (_, i) => rankedEntry(Math.floor(i / 6))),
  defenseLogs: Array.from({ length: 20 }, (_, i) => rankedEntry(Math.floor(i / 4))),
};

const leagueHistory = {
  items: [3, 2, 1].map((weeksAgo) => ({
    leagueSeasonId: player.currentLeagueSeasonId - weeksAgo * 7 * 86400,
    leagueTrophies: int(1100, 1700),
    leagueTierId: 105000026 - int(0, 2),
    placement: int(5, 90),
    attackWins: int(25, 30),
    attackLosses: int(0, 5),
    attackStars: int(60, 90),
    defenseWins: int(0, 6),
    defenseLosses: int(15, 30),
    defenseStars: int(30, 70),
    maxBattles: 30,
  })),
};

const tierNames = ["Unranked"];
for (const league of ["Skeleton", "Barbarian", "Archer", "Wizard", "Valkyrie", "Witch", "Golem", "P.E.K.K.A", "Titan", "Dragon", "Electro"]) {
  for (const n of [3, 2, 1]) tierNames.push(`${league} ${n === 3 ? "III" : n === 2 ? "II" : "I"}`);
}
tierNames.push("Legend II", "Legend I");
const leagueTiers = {
  items: tierNames.map((name, i) => ({ id: 105000000 + i, name, iconUrls: { small: "/mock-badge.svg", large: "/mock-badge.svg" } })),
};

const files = {
  "battlelog.json": battleLog,
  "ranked-group.json": rankedGroup,
  "leaguehistory.json": leagueHistory,
  "leaguetiers.json": leagueTiers,
  "clan.json": clan,
  "currentwar.json": currentWar,
  "warlog.json": warLog,
  "leaguegroup.json": leagueGroup,
  "cwl-wars.json": cwlWars,
  "capitalraidseasons.json": capitalRaids,
  "player.json": player,
  "locations.json": locations,
  "rankings-players.json": playerRankings,
  "rankings-clans.json": clanRankings,
  "clan-search.json": clanSearch,
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
}
console.log(`Wrote ${Object.keys(files).length} fixtures to ${OUT}`);
