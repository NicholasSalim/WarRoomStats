// Builds src/lib/coc/army-ids.json: game id -> English name for troops,
// spells, heroes, pets and hero equipment, used to decode battle log
// `armyShareCode`s. Source: coc.py's static game data (MIT,
// https://github.com/mathsman5133/coc.py). Re-run when the game adds units:
//   node scripts/build-army-ids.mjs

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "https://raw.githubusercontent.com/mathsman5133/coc.py/master/coc/static/static_data.json";
const SECTIONS = ["troops", "spells", "heroes", "pets", "equipment"];

// Ids newer than the coc.py table, confirmed by hand. Only fill gaps: the
// upstream name wins once it exists.
const OVERRIDES = {
  heroes: {
    28000007: "Dragon Duke", // confirmed by the project owner, 2026-11-07
  },
  troops: {
    4000109: "Ruin Witch", // confirmed by the project owner, 2026-11-08
    4000188: "Sky Wagon", // siege machine; owner reported it, id matched in live data 2026-11-08
  },
  spells: {
    26000123: "Angry Spell", // live data 2026-11-08 (local probe script, not committed), few samples
  },
  pets: {
    73000017: "Greedy Raven", // confirmed by the project owner, 2026-11-08
  },
  // Matched 2026-11-07 against live data (local probe script, not committed: equipped
  // items vs. army-code ids over 60 players). 90000056/57 had the fewest samples.
  equipment: {
    90000016: "Monolith Arrow",
    90000052: "Fire Heart",
    90000053: "Rocket Backpack",
    90000056: "Stun Blaster",
    90000057: "Flame Blower",
    90000059: "Electro Fangs",
    90000060: "Revenge Deck",
    90000061: "Portal Pendant", // 150 players

  },
};

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const data = await res.json(); // Parsed as data only; nothing from it is executed.

const out = { source: SOURCE, generated: new Date().toISOString().slice(0, 10) };
for (const section of SECTIONS) {
  const items = data[section];
  if (!Array.isArray(items)) throw new Error(`Section "${section}" missing or not an array`);
  const map = {};
  for (const item of items) {
    const id = item?._id;
    const name = item?.name;
    if (!Number.isInteger(id) || typeof name !== "string" || !name.trim()) continue;
    // Builder Base units share the troop id range but never appear in army links.
    if (item.village && item.village !== "home") continue;
    map[id] = name.trim().slice(0, 60);
  }
  for (const [id, name] of Object.entries(OVERRIDES[section] ?? {})) {
    if (!map[id]) map[id] = name;
  }
  out[section] = map;
  console.log(`${section}: ${Object.keys(map).length}`);
}

const file = join(import.meta.dirname, "..", "src", "lib", "coc", "army-ids.json");
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${file}`);
