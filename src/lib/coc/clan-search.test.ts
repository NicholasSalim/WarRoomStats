import { describe, expect, it } from "vitest";
import { normalizeClanSearch, parseClanSearch } from "./clan-search";

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

describe("parseClanSearch", () => {
  it("needs a name, a tag or a label", () => {
    expect(parseClanSearch({})).toBeNull();
    expect(parseClanSearch({ name: "ab" })).toBeNull(); // too short for a name, not a tag
    expect(parseClanSearch({ labelIds: "56000000" })).not.toBeNull();
  });

  it("reads '#TAG' as a tag only, and a bare tag as both", () => {
    expect(parseClanSearch({ name: "#2prgp0l22" })).toMatchObject({ tag: "#2PRGP0L22", tagOnly: true, params: { name: undefined } });
    expect(parseClanSearch({ name: "2PRGP0L22" })).toMatchObject({ tag: "#2PRGP0L22", tagOnly: false, params: { name: "2PRGP0L22" } });
    expect(parseClanSearch({ name: "war machine" })).toMatchObject({ tag: null, tagOnly: false });
  });

  it("keeps valid labels only, deduplicated, at most 3", () => {
    const parsed = parseClanSearch({ labelIds: ["56000001,56000001", "x", "56000002,56000003,56000004"] });
    expect(parsed?.params.labelIds).toEqual([56000001, 56000002, 56000003]);
  });

  it("drops filters out of range", () => {
    const parsed = parseClanSearch({ name: "war", minMembers: "99", minClanLevel: "5", warFrequency: "sometimes", locationId: "32000006" });
    expect(parsed?.params).toMatchObject({ minMembers: undefined, minClanLevel: 5, warFrequency: undefined, locationId: 32000006 });
  });

  it("collapses spaces in what was typed and keeps it for the pager", () => {
    const parsed = parseClanSearch({ name: "  War   Machine ", page: "2" });
    expect(parsed).toMatchObject({ query: "War Machine", page: 2, canonical: "name=War+Machine", pagerParams: { name: "War Machine" } });
  });
});
