import { describe, expect, it } from "vitest";
import { RESULT_STYLE, endedWarOutcome, isOutcome, warLogResult, warOutcome } from "./war-outcome";

const opponent = { tag: "#2PP" };

describe("warLogResult", () => {
  it.each([
    ["win", "win"],
    ["lose", "lose"],
    ["tie", "tie"],
    [null, "unknown"],
    [undefined, "unknown"],
    ["", "unknown"],
    ["draw", "unknown"],
  ] as const)("%s -> %s", (result, expected) => {
    expect(warLogResult({ opponent, result })).toBe(expected);
  });

  it("reads a row without an opponent as a CWL season", () => {
    expect(warLogResult({ opponent: {}, result: "win" })).toBe("cwl");
  });
});

describe("endedWarOutcome", () => {
  const war = { clan: { stars: 30 }, opponent: { stars: 29 } };

  it("is null until the war has ended", () => {
    expect(endedWarOutcome({ ...war, state: "inWar" })).toBeNull();
    expect(endedWarOutcome({ ...war, state: "preparation" })).toBeNull();
  });

  it("decides from either side's point of view", () => {
    expect(endedWarOutcome({ ...war, state: "warEnded" })).toBe("win");
    expect(endedWarOutcome({ ...war, state: "warEnded" }, "opponent")).toBe("lose");
  });
});

describe("warOutcome", () => {
  it("decides on stars, then destruction", () => {
    expect(warOutcome({ stars: 30 }, { stars: 29 })).toBe("win");
    expect(warOutcome({ stars: 30, destructionPercentage: 90 }, { stars: 30, destructionPercentage: 91 })).toBe("lose");
    expect(warOutcome({ stars: 30, destructionPercentage: 90 }, { stars: 30, destructionPercentage: 90 })).toBe("tie");
  });
});

describe("RESULT_STYLE", () => {
  it("uses one wording for every result", () => {
    expect(Object.values(RESULT_STYLE).map((s) => s.label)).toEqual(["Win", "Loss", "Tie", "CWL", "–"]);
  });

  it("uses theme tokens, not raw colours", () => {
    for (const s of Object.values(RESULT_STYLE)) {
      expect(s.badge).not.toMatch(/#/);
      expect(s.color).toMatch(/^var\(--/);
    }
  });

  it("only charts decided wars", () => {
    expect((["win", "lose", "tie", "cwl", "unknown"] as const).filter(isOutcome)).toEqual(["win", "lose", "tie"]);
  });
});
