import { describe, expect, it } from "vitest";
import { mergeReviewStores, parseReviewSyncDocument } from "./review-sync";

describe("review sync helpers", () => {
  it("keeps the most recently reviewed record when devices disagree", () => {
    const local = { serenity: { source: "dictionary" as const, state: "learning" as const, nextReviewAt: 8_000, repetitions: 2, lastReviewedAt: 7_000 } };
    const remote = { serenity: { source: "dictionary" as const, state: "known" as const, nextReviewAt: 9_000, repetitions: 3, lastReviewedAt: 8_000 } };

    expect(mergeReviewStores(local, remote)).toEqual(remote);
  });

  it("keeps the furthest future schedule when neither device has reviewed a record", () => {
    const local = { adore: { source: "manual" as const, state: "new" as const, nextReviewAt: 2_000, repetitions: 0 } };
    const remote = { adore: { source: "manual" as const, state: "new" as const, nextReviewAt: 4_000, repetitions: 0 } };

    expect(mergeReviewStores(local, remote)).toEqual(remote);
  });

  it("rejects malformed review sync documents", () => {
    expect(parseReviewSyncDocument({ version: -1, reviewStore: {} })).toBeNull();
    expect(parseReviewSyncDocument({ version: 2, reviewStore: {} })).toEqual({ version: 2, reviewStore: {} });
  });
});
