export type EntrySource = "dictionary" | "ai" | "manual" | "imported" | "needs-review";
export type ReviewState = "new" | "learning" | "known";
export type ReviewRating = "again" | "hard" | "good" | "easy";

export type ReviewMetadata = {
  source: EntrySource;
  state: ReviewState;
  nextReviewAt: number;
  repetitions: number;
  lastReviewedAt?: number;
};

export type ReviewStore = Record<string, ReviewMetadata>;

const minute = 60 * 1000;
const day = 24 * 60 * minute;

export function entryReviewKey(word: string): string {
  return word.trim().toLocaleLowerCase();
}

export function createInitialReviewMetadata(source: EntrySource, now = Date.now()): ReviewMetadata {
  return {
    source,
    state: "new",
    nextReviewAt: now,
    repetitions: 0,
  };
}

export function parseReviewStore(value: string | null): ReviewStore {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, Partial<ReviewMetadata>>;
    const records: ReviewStore = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (!item || typeof item !== "object") continue;
      const source = item.source;
      const state = item.state;
      if (!(["dictionary", "ai", "manual", "imported", "needs-review"] as string[]).includes(String(source))) continue;
      if (!(["new", "learning", "known"] as string[]).includes(String(state))) continue;
      if (typeof item.nextReviewAt !== "number" || !Number.isFinite(item.nextReviewAt)) continue;
      if (typeof item.repetitions !== "number" || !Number.isFinite(item.repetitions)) continue;
      records[key] = {
        source: source as EntrySource,
        state: state as ReviewState,
        nextReviewAt: item.nextReviewAt,
        repetitions: Math.max(0, Math.floor(item.repetitions)),
        ...(typeof item.lastReviewedAt === "number" && Number.isFinite(item.lastReviewedAt)
          ? { lastReviewedAt: item.lastReviewedAt }
          : {}),
      };
    }
    return records;
  } catch {
    return {};
  }
}

export function isReviewDue(metadata: ReviewMetadata | undefined, now = Date.now()): boolean {
  return !metadata || metadata.nextReviewAt <= now;
}

export function scheduleReview(metadata: ReviewMetadata, rating: ReviewRating, now = Date.now()): ReviewMetadata {
  if (rating === "again") {
    return {
      ...metadata,
      state: "learning",
      repetitions: 0,
      nextReviewAt: now + 10 * minute,
      lastReviewedAt: now,
    };
  }

  if (rating === "hard") {
    return {
      ...metadata,
      state: "learning",
      nextReviewAt: now + day,
      lastReviewedAt: now,
    };
  }

  const repetitions = metadata.repetitions + 1;
  const intervalDays = rating === "easy"
    ? Math.min(45, 7 * Math.max(1, repetitions))
    : Math.min(21, 3 * Math.max(1, repetitions));
  return {
    ...metadata,
    state: repetitions >= 3 ? "known" : "learning",
    repetitions,
    nextReviewAt: now + intervalDays * day,
    lastReviewedAt: now,
  };
}

export function sourceLabel(source: EntrySource): string {
  return {
    dictionary: "Dictionary",
    ai: "AI enriched",
    manual: "Manual",
    imported: "Imported",
    "needs-review": "Needs review",
  }[source];
}
