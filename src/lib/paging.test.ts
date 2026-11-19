import { describe, expect, it } from "vitest";
import { paginate, parsePage } from "./paging";

describe("parsePage", () => {
  it("reads the page param defensively", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage(["2"])).toBe(1);
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 201 }, (_, i) => i + 1);

  it("cuts a page and says where it starts", () => {
    const p = paginate(rows, 2, 100);
    expect(p).toMatchObject({ page: 2, totalPages: 3, from: 101 });
    expect(p.shown[0]).toBe(101);
    expect(p.shown).toHaveLength(100);
  });

  it("clamps pages past the end to the last page", () => {
    expect(paginate(rows, 9, 100)).toMatchObject({ page: 3, shown: [201] });
  });

  it("gives an empty list one empty page", () => {
    expect(paginate([], 1, 50)).toEqual({ page: 1, totalPages: 1, shown: [], from: 1 });
  });
});
