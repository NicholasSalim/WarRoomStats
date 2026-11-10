import { describe, expect, it } from "vitest";
import {
  archiveCursor,
  cursorPosition,
  isLegendSeasonId,
  legendSeasonEnd,
  legendSeasonLabel,
  pageCount,
  pageSlice,
  parsePage,
} from "./rankings";

describe("paging", () => {
  it("parses the page param defensively", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage(["2"])).toBe(1);
  });

  it("counts and slices pages of 100", () => {
    expect(pageCount(200)).toBe(2);
    expect(pageCount(201)).toBe(3);
    expect(pageCount(0)).toBe(1);
    const rows = Array.from({ length: 200 }, (_, i) => i + 1);
    expect(pageSlice(rows, 2)[0]).toBe(101);
    expect(pageSlice(rows, 2)).toHaveLength(100);
    expect(pageSlice(rows, 3)).toEqual([]);
  });

  it("builds the archive's cursors (base64 of {pos})", () => {
    expect(archiveCursor(1)).toBeNull();
    // The exact cursor the live API returned after the first 100 rows.
    expect(archiveCursor(2)).toBe("eyJwb3MiOjEwMH0");
    expect(cursorPosition(archiveCursor(57))).toBe(5600);
    expect(cursorPosition("not base64 json")).toBe(0);
    expect(cursorPosition(null)).toBe(0);
  });
});

describe("Legend season ids", () => {
  it("accepts the archive's id formats only", () => {
    expect(isLegendSeasonId("v2-2026-10-26T05:00:00Z")).toBe(true);
    expect(isLegendSeasonId("2015-07")).toBe(true);
    expect(isLegendSeasonId("2026-04-20")).toBe(true);
    expect(isLegendSeasonId("../players")).toBe(false);
    expect(isLegendSeasonId("v2-2026-10-26")).toBe(false);
  });

  it("puts a v2 season's end 7 days after its id", () => {
    // Matches the league-history season that ended 2026-11-02 05:00 UTC.
    expect(legendSeasonEnd("v2-2026-10-26T05:00:00Z")?.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(legendSeasonEnd("2015-07")).toBeNull();
  });

  it("labels seasons", () => {
    expect(legendSeasonLabel("v2-2026-10-26T05:00:00Z")).toBe("Ended 2 Nov 2026");
    expect(legendSeasonLabel("2015-07")).toBe("July 2015");
    expect(legendSeasonLabel("2026-04-20")).toBe("20 Apr 2026");
  });
});
