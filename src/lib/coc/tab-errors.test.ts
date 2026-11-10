import { describe, expect, it } from "vitest";
import { ERROR_COPY, type ApiErrorKind } from "./errors";
import { tabError } from "./tab-errors";

describe("tabError", () => {
  const kinds = Object.keys(ERROR_COPY) as ApiErrorKind[];

  it.each(["invalidTag", "notFound"] as const)("leaves %s to the layout", (kind) => {
    expect(tabError({ kind, status: 404 })).toBeNull();
  });

  it.each(kinds.filter((k) => k !== "invalidTag" && k !== "notFound"))("shows %s in the tab", (kind) => {
    const error = { kind, status: 500 };
    expect(tabError(error)).toBe(error);
  });
});
