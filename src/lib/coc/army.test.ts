import { describe, expect, it } from "vitest";
import { armyName, copyArmyLink, parseArmyCode } from "./army";

describe("parseArmyCode", () => {
  it("decodes a real battle log code (heroes with pet and equipment, troops)", () => {
    const army = parseArmyCode("h4p10e40_13-7e52_53u94x55-3x28");
    const names = army?.heroes.map((h) => ({ name: h.name, pet: h.pet?.name, equipment: h.equipment.map((e) => e.name) }));
    expect(names).toEqual([
      { name: "Royal Champion", pet: "Spirit Fox", equipment: ["Electro Boots", "Rocket Spear"] },
      // Hero 7 (Dragon Duke) is a manual override; equipment 52/53 are newer than the id table.
      { name: "Dragon Duke", pet: undefined, equipment: [armyName("equipment", 52), armyName("equipment", 53)] },
    ]);
    expect(army?.troops.map(({ id, count, name }) => ({ id, count, name }))).toEqual([
      { id: 55, count: 94, name: "Sneaky Goblin" },
      { id: 28, count: 3, name: "Super Wall Breaker" },
    ]);
    expect(army?.spells).toEqual([]);
  });

  it("decodes spells and clan castle sections", () => {
    const army = parseArmyCode("u10x0-5x1s2x0i1x8d1x2");
    expect(army?.troops.map((t) => `${t.count} ${t.name}`)).toEqual(["10 Barbarian", "5 Archer"]);
    expect(army?.spells.map((t) => `${t.count} ${t.name}`)).toEqual(["2 Lightning Spell"]);
    expect(army?.castleTroops).toHaveLength(1);
    expect(army?.castleSpells.map((s) => s.name)).toEqual(["Rage Spell"]);
  });

  it("names unknown ids with a placeholder instead of failing", () => {
    expect(armyName("troop", 9999)).toBe("Troop #9999");
    expect(parseArmyCode("u1x9999")?.troops[0].name).toBe("Troop #9999");
  });

  it("returns null for empty or junk input", () => {
    expect(parseArmyCode("")).toBeNull();
    expect(parseArmyCode(undefined)).toBeNull();
    expect(parseArmyCode("zzz")).toBeNull();
    expect(parseArmyCode("x".repeat(600))).toBeNull();
  });

  it("skips malformed items", () => {
    expect(parseArmyCode("u10x0-garbage-0x3")?.troops.map((t) => `${t.count} ${t.name}`)).toEqual(["10 Barbarian"]);
  });
});

describe("copyArmyLink", () => {
  it("builds the official CopyArmy deep link", () => {
    expect(copyArmyLink("u10x0")).toBe("https://link.clashofclans.com/en?action=CopyArmy&army=u10x0");
  });
});
