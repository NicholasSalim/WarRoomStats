// Writes src/lib/coc/unit-icons.json ("<kind>:<name>" -> public URL) from the
// unit images in public/{troops,siege-machines,spells,heroes,hero-pets,hero-equipments}.
// File names are matched to the names in army-ids.json; MANUAL covers the rest.
// Prints images it could not place and units that have no image.
//
//   node scripts/build-unit-icons.mjs

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const IDS = JSON.parse(readFileSync(join(ROOT, "src/lib/coc/army-ids.json"), "utf8"));

const FOLDERS = [
  ["troop", "troops"],
  ["troop", "siege-machines"],
  ["spell", "spells"],
  ["hero", "heroes"],
  ["pet", "hero-pets"],
  ["equipment", "hero-equipments"],
];
const SECTIONS = { troop: "troops", spell: "spells", hero: "heroes", pet: "pets", equipment: "equipment" };

// "<folder>/<file>": unit name, for files whose name differs from the unit's.
const MANUAL = {
  "troops/Wallbreaker.png": "Wall Breaker",
  "troops/Icon_HV_Super_Ice_Hound.png": "Ice Hound",
  "troops/Icon_HV_Super_Inferno_Dragon.png": "Inferno Dragon",
  "troops/Icon_HV_Super_Rocket_Balloon.png": "Rocket Balloon",
  "troops/MeteoriteGolem_withGrassbase_f61_layered_3k .png": "Meteor Golem",
  "troops/Thrower_05_grass.png": "Thrower",
  "troops/Druid_HV_01.png": "Druid",
  "troops/Furnace_HV_01.png": "Furnace",
  "troops/Ruinwitch_f108_4k.png": "Ruin Witch",
  "siege-machines/Siege_Machine_Sky_wagon_01.png": "Sky Wagon",
  "siege-machines/icon_troop_launcher.png": "Troop Launcher",
  "troops/icon_super_yeti.png": "Super Yeti",
  "spells/icon_angry_spell.png": "Angry Spell",
  "hero-pets/pet_Greedy_Raven_1_grasspng.png": "Greedy Raven",
  "spells/Icon_HV_Spell_Heal.png": "Healing Spell",
  "spells/Icon_HV_Spell_Freeze_new.png": "Freeze Spell",
  "spells/Icon_HV_Spell_Lightning_new.png": "Lightning Spell",
  "heroes/Hero_Minion_Prince_02_grass.png": "Minion Prince",
  "heroes/Dragon_duke.png": "Dragon Duke",
  "hero-pets/Icon_HV_Hero_Pets_LASSI.png": "L.A.S.S.I",
  "hero-pets/Hero_Pet_HV_Angry_Jelly_02.png": "Angry Jelly",
  "hero-equipments/HeroEquipment_MP_IronPants.png": "Metal Pants",
  "hero-equipments/HeroGear_BK_StickFireHorse.png": "Stick Horse",
  "hero-equipments/HeroGear_MP_DarkCrown_2k.png": "Dark Crown",
  "hero-equipments/HeroGear_RoyalChampion_RocketSpear_Equipment_03.png": "Rocket Spear",
  "hero-equipments/Hero_Equipment_RC_Hog_Rider_Doll.png": "Hog Rider Puppet",
  "hero-equipments/Hero_Equipment_MP_Henchman.png": "Henchmen Puppet",
  "hero-equipments/Hero_Equipment_DD_reverse_card.png": "Revenge Deck",
  "hero-equipments/HG_DD_StunBlast.png": "Stun Blaster",
  "hero-equipments/HG_DD_Rocket_BackPack.png": "Rocket Backpack",
  "hero-equipments/Hero_Equipement_LavaloonPuppet.png": "Lavaloon Puppet",
  "hero-equipments/HeroGear_GW_Olympic_Torch_hh0000.png": "Heroic Torch",
  "hero-equipments/HeroGear_MP_MeteoriteSceptre.png": "Meteor Staff",
  "hero-equipments/Hero_Equipment_AQ_WWEActionFigure.png": "Action Figure",
  "hero-equipments/Hero_Equipement_portal_pendant.png": "Portal Pendant",
  "hero-equipments/Hero_Equipment_MP_PowerPump.png": "Noble Iron", // confirmed by the project owner
};

// Files to leave out: alternate versions and exact duplicates.
const SKIP = new Set([
  "spells/Icon_HV_Spell_Freeze_old.png",
  "spells/Icon_HV_Spell_Lightning_old.png",
  "hero-equipments/icon_gear_GW_LavaloonPuppet.png",
]);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const stem = (file) =>
  norm(
    file
      .replace(/\.[a-z]+$/i, "")
      .replace(/^(icon_hv_siege_machine_|siege_machine_hv_|icon_hv_hero_pets_|icon_hv_hero_|icon_hv_dark_spell_|icon_hv_spell_|icon_hv_|hero_equipe?ment_[a-z]+_|hg_[a-z]+_)/i, "")
      .replace(/_\d+$/, ""), // "Log_Launcher_3" -> "Log_Launcher"
  );

const manifest = {};
const unplaced = [];
for (const [kind, folder] of FOLDERS) {
  const names = [...new Set(Object.values(IDS[SECTIONS[kind]]))];
  const byKey = new Map();
  for (const n of names) {
    byKey.set(norm(n), n);
    if (kind === "spell") byKey.set(norm(n.replace(/ spell$/i, "")), n);
  }
  let files = [];
  try {
    files = readdirSync(join(ROOT, "public", folder));
  } catch {
    continue;
  }
  for (const file of files.sort()) {
    const rel = `${folder}/${file}`;
    if (SKIP.has(rel)) continue;
    const name = MANUAL[rel] ?? byKey.get(stem(file));
    if (!name || !names.includes(name)) {
      unplaced.push(rel);
      continue;
    }
    const key = `${kind}:${name}`;
    if (manifest[key]) throw new Error(`Two images for ${key}: ${manifest[key]} and ${rel}`);
    manifest[key] = "/" + rel.split("/").map(encodeURIComponent).join("/");
  }
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(ROOT, "src/lib/coc/unit-icons.json"), JSON.stringify(sorted, null, 1) + "\n");
console.log(`Wrote ${Object.keys(sorted).length} icons to src/lib/coc/unit-icons.json`);
if (unplaced.length) console.log(`Images not matched to a known unit (${unplaced.length}): ${unplaced.join(", ")}`);
for (const [kind, section] of Object.entries(SECTIONS)) {
  const missing = [...new Set(Object.values(IDS[section]))].filter((n) => !sorted[`${kind}:${n}`]);
  if (missing.length) console.log(`No image for ${missing.length} ${section}: ${missing.join(", ")}`);
}
