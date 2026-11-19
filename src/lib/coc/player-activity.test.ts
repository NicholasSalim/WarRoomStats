import { describe, expect, it } from "vitest";
import { playerRaids, playerWar, warTotals, weekendRaiders } from "./player-activity";
import type { CapitalRaidSeason, War } from "./schemas";

const ME = "#ME";

function war(meOnOpponentSide = false): War {
  const ours = {
    tag: "#OURS",
    name: "Ours",
    stars: 30,
    destructionPercentage: 90,
    members: [
      {
        tag: ME,
        name: "Me",
        townhallLevel: 17,
        mapPosition: 3,
        attacks: [
          { attackerTag: ME, defenderTag: "#T2", stars: 2, destructionPercentage: 88, order: 5 },
          { attackerTag: ME, defenderTag: "#T1", stars: 3, destructionPercentage: 100, order: 1 },
        ],
      },
    ],
  };
  const theirs = {
    tag: "#THEIRS",
    name: "Theirs",
    stars: 20,
    destructionPercentage: 80,
    members: [
      { tag: "#T1", name: "One", townhallLevel: 16, mapPosition: 1, attacks: [{ attackerTag: "#T1", defenderTag: ME, stars: 1, destructionPercentage: 60, order: 2 }] },
      { tag: "#T2", name: "Two", townhallLevel: 17, mapPosition: 2, attacks: [{ attackerTag: "#T2", defenderTag: "#X", stars: 3, destructionPercentage: 100, order: 3 }] },
    ],
  };
  return {
    state: "warEnded",
    attacksPerMember: 2,
    clan: meOnOpponentSide ? theirs : ours,
    opponent: meOnOpponentSide ? ours : theirs,
  };
}

describe("playerWar", () => {
  it("lists the player's attacks in order, with the defender's details", () => {
    const w = playerWar(war(), ME, "Current war", false)!;
    expect(w.attacks.map((a) => [a.name, a.stars, a.position])).toEqual([
      ["One", 3, 1],
      ["Two", 2, 2],
    ]);
    expect(w.position).toBe(3);
    expect(w.attacksAllowed).toBe(2);
    expect(w.outcome).toBe("win");
    expect(w.opponent.name).toBe("Theirs");
  });

  it("only counts attacks made against the player as defenses", () => {
    const w = playerWar(war(), ME, "Current war", false)!;
    expect(w.defenses).toHaveLength(1);
    expect(w.defenses[0]).toMatchObject({ name: "One", stars: 1, destruction: 60 });
  });

  it("finds the player on either side (CWL wars can list their clan as the opponent)", () => {
    const w = playerWar(war(true), ME, "CWL round 1", true)!;
    expect(w.opponent.name).toBe("Theirs");
    expect(w.outcome).toBe("win");
  });

  it("returns null when the player isn't in the line-up", () => {
    expect(playerWar(war(), "#SOMEONE", "Current war", false)).toBeNull();
  });
});

describe("warTotals", () => {
  it("adds up attacks, stars and defenses, ignoring wars still in preparation", () => {
    const done = playerWar(war(), ME, "a", false)!;
    const prep = { ...done, state: "preparation", attacks: [], defenses: [] };
    expect(warTotals([done, prep])).toMatchObject({
      wars: 2,
      attacks: 2,
      attacksAllowed: 2,
      stars: 5,
      threeStars: 1,
      avgDestruction: 94,
      defenses: 1,
      starsConceded: 1,
    });
  });
});

describe("playerRaids", () => {
  const season = {
    state: "ended",
    startTime: "20261106T070000.000Z",
    endTime: "20261109T070000.000Z",
    capitalTotalLoot: 1,
    members: [{ tag: ME, name: "Me", attacks: 6, attackLimit: 5, bonusAttackLimit: 1, capitalResourcesLooted: 25000 }],
    attackLog: [
      {
        defender: { tag: "#D", name: "Defender" },
        attackCount: 3,
        districtCount: 1,
        districtsDestroyed: 1,
        districts: [
          {
            id: 1,
            name: "Capital  Peak",
            districtHallLevel: 10,
            destructionPercent: 100,
            attackCount: 2,
            attacks: [
              { attacker: { tag: ME, name: "Me" }, destructionPercent: 70, stars: 2 },
              { attacker: { tag: "#OTHER", name: "Other" }, destructionPercent: 100, stars: 3 },
            ],
          },
        ],
      },
    ],
    defenseLog: [],
  } as CapitalRaidSeason;

  it("picks out the player's totals and their own district attacks", () => {
    const [w] = playerRaids([season], ME);
    expect(w).toMatchObject({ attacks: 6, attackLimit: 6, looted: 25000 });
    expect(w.districtAttacks).toEqual([{ clan: "Defender", district: "Capital Peak", hallLevel: 10, stars: 2, destruction: 70 }]);
  });

  it("marks weekends the player sat out", () => {
    const [w] = playerRaids([season], "#SOMEONE");
    expect(w.attacks).toBeNull();
    expect(w.districtAttacks).toEqual([]);
  });

  // Only the latest weekend has a member list; older ones have clan totals only.
  const older = { ...season, members: undefined } as CapitalRaidSeason;

  it("leaves out weekends without a member list", () => {
    expect(playerRaids([season, older], ME)).toHaveLength(1);
    expect(weekendRaiders(older)).toEqual([]);
  });

  it("lists raiders from the member list", () => {
    expect(weekendRaiders(season)).toEqual([{ tag: ME, name: "Me", attacks: 6, attackLimit: 6, looted: 25000 }]);
  });
});
