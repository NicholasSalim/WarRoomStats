// Groups the API's flat `troops` list. The API doesn't tag unit categories,
// so these name lists need updating when the game adds siege machines or pets.

import type { PlayerUnit } from "./schemas";

const SIEGE_MACHINES = new Set([
  "Wall Wrecker",
  "Battle Blimp",
  "Stone Slammer",
  "Siege Barracks",
  "Log Launcher",
  "Flame Flinger",
  "Battle Drill",
  "Troop Launcher",
]);

const PETS = new Set([
  "L.A.S.S.I",
  "Electro Owl",
  "Mighty Yak",
  "Unicorn",
  "Frosty",
  "Diggy",
  "Poison Lizard",
  "Phoenix",
  "Spirit Fox",
  "Angry Jelly",
  "Sneezy",
]);

const SUPER_TROOPS = new Set([
  "Super Barbarian",
  "Super Archer",
  "Super Giant",
  "Sneaky Goblin",
  "Super Wall Breaker",
  "Rocket Balloon",
  "Super Wizard",
  "Super Dragon",
  "Inferno Dragon",
  "Super Minion",
  "Super Valkyrie",
  "Super Witch",
  "Ice Hound",
  "Super Bowler",
  "Super Miner",
  "Super Hog Rider",
  "Super Yeti",
]);

export interface GroupedTroops {
  troops: PlayerUnit[];
  siegeMachines: PlayerUnit[];
  pets: PlayerUnit[];
  activeSuperTroops: PlayerUnit[];
  builderBase: PlayerUnit[];
}

export function groupTroops(units: PlayerUnit[]): GroupedTroops {
  const out: GroupedTroops = { troops: [], siegeMachines: [], pets: [], activeSuperTroops: [], builderBase: [] };
  for (const u of units) {
    if (u.village === "builderBase") out.builderBase.push(u);
    else if (u.village !== "home") continue;
    else if (SUPER_TROOPS.has(u.name)) {
      if (u.superTroopIsActive) out.activeSuperTroops.push(u);
    } else if (SIEGE_MACHINES.has(u.name)) out.siegeMachines.push(u);
    else if (PETS.has(u.name)) out.pets.push(u);
    else out.troops.push(u);
  }
  return out;
}
