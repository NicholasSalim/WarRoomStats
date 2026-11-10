import { describe, expect, it } from "vitest";
import { battleTypeLabel, fmtDuration, fmtPct, fmtRatio, roleLabel, seasonLabel } from "./format";

describe("seasonLabel", () => {
  it.each([
    ["2026-11", "November 2026"],
    ["2026-11-03", "November 2026"], // CWL season format seen on the live API
    ["2025-03", "March 2025"],
  ])("%s -> %s", (input, expected) => {
    expect(seasonLabel(input)).toBe(expected);
  });

  it("passes unknown formats through and handles missing values", () => {
    expect(seasonLabel("S12")).toBe("S12");
    expect(seasonLabel(undefined)).toBe("–");
  });
});

describe("small formatters", () => {
  it("formats percentages without trailing zeros", () => {
    expect(fmtPct(100)).toBe("100%");
    expect(fmtPct(41.38, 2)).toBe("41.38%");
    expect(fmtPct(null)).toBe("–");
  });

  it("formats ratios", () => {
    expect(fmtRatio(1.5)).toBe("1.50");
    expect(fmtRatio(Infinity)).toBe("∞");
    expect(fmtRatio(null)).toBe("–");
  });

  it("labels battle types and durations", () => {
    expect(battleTypeLabel("ranked")).toBe("Ranked");
    expect(battleTypeLabel("homeVillage")).toBe("Regular");
    expect(battleTypeLabel("someNewMode")).toBe("Some New Mode");
    expect(fmtDuration(141)).toBe("2m 21s");
    expect(fmtDuration(35)).toBe("35s");
    expect(fmtDuration(undefined)).toBe("–");
  });

  it("maps API roles to in-game names", () => {
    expect(roleLabel("admin")).toBe("Elder");
    expect(roleLabel("coLeader")).toBe("Co-leader");
  });
});
