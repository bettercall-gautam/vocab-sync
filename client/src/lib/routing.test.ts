import { describe, expect, it } from "vitest";
import { getRouterBase } from "./routing";

describe("getRouterBase", () => {
  it("uses Wouter's default root base during local development", () => {
    expect(getRouterBase("/")).toBeUndefined();
  });

  it("removes the trailing slash from a GitHub Pages project base", () => {
    expect(getRouterBase("/vocab-sync/")).toBe("/vocab-sync");
  });
});
