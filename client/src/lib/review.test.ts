import { describe, expect, it } from "vitest";
import {
  createInitialReviewMetadata,
  entryReviewKey,
  isReviewDue,
  parseReviewStore,
  reviewPromptDirection,
  scheduleReview,
} from "./review";

describe("review helpers", () => {
  it("creates a stable local key and schedules a new entry immediately", () => {
    expect(entryReviewKey("  Serenity ")).toBe("serenity");
    const metadata = createInitialReviewMetadata("dictionary", 1_000);
    expect(metadata).toMatchObject({ source: "dictionary", state: "new", nextReviewAt: 1_000, repetitions: 0 });
    expect(isReviewDue(metadata, 1_000)).toBe(true);
  });

  it("resets an unsuccessful recall for a short retry", () => {
    const result = scheduleReview(createInitialReviewMetadata("ai", 1_000), "again", 2_000);
    expect(result).toMatchObject({ state: "learning", repetitions: 0, nextReviewAt: 602_000, lastReviewedAt: 2_000 });
  });

  it("extends successful recall intervals deterministically", () => {
    const first = scheduleReview(createInitialReviewMetadata("manual", 0), "good", 1_000);
    const second = scheduleReview(first, "good", 2_000);
    const easy = scheduleReview(second, "easy", 3_000);

    expect(first).toMatchObject({ state: "learning", repetitions: 1, nextReviewAt: 3 * 24 * 60 * 60 * 1000 + 1_000 });
    expect(second).toMatchObject({ state: "learning", repetitions: 2, nextReviewAt: 6 * 24 * 60 * 60 * 1000 + 2_000 });
    expect(easy).toMatchObject({ state: "known", repetitions: 3, nextReviewAt: 21 * 24 * 60 * 60 * 1000 + 3_000 });
  });

  it("alternates recall direction after each successful repetition", () => {
    const newEntry = createInitialReviewMetadata("dictionary", 0);
    const firstSuccess = scheduleReview(newEntry, "good", 1_000);

    expect(reviewPromptDirection(newEntry)).toBe("word-to-meaning");
    expect(reviewPromptDirection(firstSuccess)).toBe("meaning-to-word");
    expect(reviewPromptDirection({ ...firstSuccess, repetitions: 2 })).toBe("word-to-meaning");
  });

  it("rejects malformed persisted review metadata without throwing", () => {
    expect(parseReviewStore('{"serenity":{"source":"dictionary","state":"learning","nextReviewAt":123,"repetitions":2},"bad":{"source":"nope"}}'))
      .toEqual({ serenity: { source: "dictionary", state: "learning", nextReviewAt: 123, repetitions: 2 } });
  });
});
