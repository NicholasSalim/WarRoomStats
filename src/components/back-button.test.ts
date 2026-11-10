import { describe, expect, it } from "vitest";
import { backFallback } from "./back-button";

describe("backFallback", () => {
  it("goes one level up for nested player and clan pages", () => {
    expect(backFallback("/player/L2LJ9QLU/season")).toBe("/player/L2LJ9QLU");
    expect(backFallback("/clan/2PRGP0L22/war")).toBe("/clan/2PRGP0L22");
    expect(backFallback("/clan/2PRGP0L22/cwl")).toBe("/clan/2PRGP0L22");
  });

  it("goes home from everything else", () => {
    expect(backFallback("/player/L2LJ9QLU")).toBe("/");
    expect(backFallback("/search")).toBe("/");
    expect(backFallback("/leaderboards")).toBe("/");
  });
});
