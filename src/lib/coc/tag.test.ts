import { describe, expect, it } from "vitest";
import { clanHref, isImpossibleTagPath, normalizeTag, playerHref, tagToSlug } from "./tag";

describe("normalizeTag", () => {
  it.each([
    ["#2PP", "#2PP"],
    ["2pp", "#2PP"],
    ["  #2pp  ", "#2PP"],
    ["%232PP", "#2PP"],
    ["#2P P", "#2PP"],
    ["#2PO", "#2P0"], // O is corrected to 0
  ])("normalises %j to %j", (input, expected) => {
    expect(normalizeTag(input)).toBe(expected);
  });

  it.each(["", "#", "#ABC", "2PP!", "#2PP#", "<script>", "../../etc", "#2PP/warlog", "%E0%A4%A", "#" + "2".repeat(20)])(
    "rejects %j",
    (input) => {
      expect(normalizeTag(input)).toBeNull();
    },
  );

  it("rejects null and undefined", () => {
    expect(normalizeTag(null)).toBeNull();
    expect(normalizeTag(undefined)).toBeNull();
  });
});

describe("hrefs", () => {
  it("builds app URLs without the #", () => {
    expect(tagToSlug("#2PP")).toBe("2PP");
    expect(clanHref("#2PP")).toBe("/clan/2PP");
    expect(playerHref("#9YC")).toBe("/player/9YC");
  });
});

describe("isImpossibleTagPath", () => {
  it.each([
    ["/clan/notatag", true],
    ["/player/hello!/battles", true],
    ["/clan/%ZZ", true],
    ["/clan/2PRGP0L22", false],
    ["/clan/2prgp0l22/warlog", false],
    ["/player/%232PP", false],
    ["/clan/2PPO", false], // O is read as 0
    ["/leaderboards", false],
    ["/", false],
  ])("%s -> %s", (path, expected) => {
    expect(isImpossibleTagPath(path)).toBe(expected);
  });
});
