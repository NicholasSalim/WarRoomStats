// Decodes the battle log's `armyShareCode` (the in-game army link format).
// Format per coc.py's ArmyRecipe (MIT): sections
//   h  heroes, "-"-separated: <heroId>[m<n>][p<petId>][e<eq1>[_<eq2>]]
//   u  troops, s spells, i clan castle troops, d clan castle spells:
//      "-"-separated <count>x<id>
// Ids are offsets from a per-category base game id.
// Names come from army-ids.json (scripts/build-army-ids.mjs); unknown ids,
// e.g. units newer than that table, get a readable placeholder.

import ids from "./army-ids.json";
import icons from "./unit-icons.json";

const BASE = { troop: 4_000_000, spell: 26_000_000, hero: 28_000_000, pet: 73_000_000, equipment: 90_000_000 } as const;

const NAMES: Record<keyof typeof BASE, Record<string, string>> = {
  troop: ids.troops,
  spell: ids.spells,
  hero: ids.heroes,
  pet: ids.pets,
  equipment: ids.equipment,
};

const PLACEHOLDER: Record<keyof typeof BASE, string> = {
  troop: "Troop",
  spell: "Spell",
  hero: "Hero",
  pet: "Pet",
  equipment: "Equipment",
};

export type ArmyKind = keyof typeof BASE;

export function armyName(kind: ArmyKind, id: number): string {
  return NAMES[kind][String(BASE[kind] + id)] ?? `${PLACEHOLDER[kind]} #${id}`;
}

// Unit images in public/ linked by scripts/build-unit-icons.mjs,
// keyed "<kind>:<name>".
const ICONS = icons as Record<string, string>;

/** Public path of a unit's icon, or undefined when there is none (show text). */
export function unitIcon(kind: ArmyKind, name: string): string | undefined {
  return ICONS[`${kind}:${name}`];
}

export interface ArmyUnit {
  id: number;
  name: string;
  count: number;
  icon?: string;
}

export interface ArmyPart {
  name: string;
  icon?: string;
}

export interface ArmyHero {
  id: number;
  name: string;
  icon?: string;
  pet?: ArmyPart;
  equipment: ArmyPart[];
}

function armyPart(kind: ArmyKind, id: number): ArmyPart {
  const name = armyName(kind, id);
  return { name, icon: unitIcon(kind, name) };
}

export interface Army {
  heroes: ArmyHero[];
  troops: ArmyUnit[];
  spells: ArmyUnit[];
  castleTroops: ArmyUnit[];
  castleSpells: ArmyUnit[];
}

const SECTION = /([hiuds])([^hiuds]*)/g;
const HERO = /^(\d+)(?:m\d+)?(?:p(\d+))?(?:e(\d+)(?:_(\d+))?)?$/;
const ITEM = /^(\d+)x(\d+)$/;

function parseItems(body: string, kind: "troop" | "spell"): ArmyUnit[] {
  const out: ArmyUnit[] = [];
  for (const part of body.split("-")) {
    const m = ITEM.exec(part);
    if (!m) continue;
    const count = Number(m[1]);
    const id = Number(m[2]);
    if (count > 0) {
      const name = armyName(kind, id);
      out.push({ id, count, name, icon: unitIcon(kind, name) });
    }
  }
  return out;
}

/** Returns null for an empty or unparseable code. */
export function parseArmyCode(code: string | undefined | null): Army | null {
  if (!code || code.length > 500) return null;
  const army: Army = { heroes: [], troops: [], spells: [], castleTroops: [], castleSpells: [] };
  let found = false;
  for (const [, section, body] of code.matchAll(SECTION)) {
    found = true;
    if (section === "h") {
      for (const part of body.split("-")) {
        const m = HERO.exec(part);
        if (!m) continue;
        const hero = armyPart("hero", Number(m[1]));
        army.heroes.push({
          id: Number(m[1]),
          ...hero,
          pet: m[2] != null ? armyPart("pet", Number(m[2])) : undefined,
          equipment: [m[3], m[4]].filter((e): e is string => e != null).map((e) => armyPart("equipment", Number(e))),
        });
      }
    } else if (section === "u") army.troops.push(...parseItems(body, "troop"));
    else if (section === "s") army.spells.push(...parseItems(body, "spell"));
    else if (section === "i") army.castleTroops.push(...parseItems(body, "troop"));
    else if (section === "d") army.castleSpells.push(...parseItems(body, "spell"));
  }
  return found ? army : null;
}

/** Official deep link that opens the army in the game's army editor. */
export function copyArmyLink(code: string): string {
  return `https://link.clashofclans.com/en?action=CopyArmy&army=${encodeURIComponent(code)}`;
}
