import { describe, expect, it } from "vitest";
import { normalizeClanSearch } from "./clan-search";

describe("normalizeClanSearch", () => {
  it("gives searches the API treats alike the same key", () => {
    const a = normalizeClanSearch({ name: " War  Machine ", labelIds: [56000002, 56000000] });
    const b = normalizeClanSearch({ name: "war machine", labelIds: [56000000, 56000002, 56000000] });
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toEqual({ name: "war machine", labelIds: [56000000, 56000002] });
  });

  it("drops unset filters so they don't split the cache", () => {
    expect(normalizeClanSearch({ name: "x", labelIds: [], warFrequency: undefined, locationId: undefined })).toEqual({ name: "x" });
    expect(Object.keys(normalizeClanSearch({ name: "  " }))).toEqual([]);
  });

  it("keeps the other filters", () => {
    expect(normalizeClanSearch({ labelIds: [56000001], warFrequency: "always", locationId: 32000006, minMembers: 10, minClanLevel: 5 })).toEqual({
      labelIds: [56000001],
      warFrequency: "always",
      locationId: 32000006,
      minMembers: 10,
      minClanLevel: 5,
    });
  });
});
