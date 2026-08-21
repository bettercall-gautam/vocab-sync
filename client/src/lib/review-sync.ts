import { type ReviewMetadata, type ReviewStore } from "./review";

export type ReviewSyncDocument = {
  version: number;
  reviewStore: ReviewStore;
};

function compareReviewMetadata(left: ReviewMetadata, right: ReviewMetadata): ReviewMetadata {
  const leftReviewedAt = left.lastReviewedAt ?? 0;
  const rightReviewedAt = right.lastReviewedAt ?? 0;
  if (leftReviewedAt !== rightReviewedAt) return leftReviewedAt > rightReviewedAt ? left : right;
  if (left.nextReviewAt !== right.nextReviewAt) return left.nextReviewAt > right.nextReviewAt ? left : right;
  if (left.repetitions !== right.repetitions) return left.repetitions > right.repetitions ? left : right;
  return left;
}

export function mergeReviewStores(local: ReviewStore, remote: ReviewStore): ReviewStore {
  const merged: ReviewStore = { ...remote };
  for (const [key, localMetadata] of Object.entries(local)) {
    const remoteMetadata = remote[key];
    merged[key] = remoteMetadata ? compareReviewMetadata(localMetadata, remoteMetadata) : localMetadata;
  }
  return merged;
}

export function parseReviewSyncDocument(value: unknown): ReviewSyncDocument | null {
  if (!value || typeof value !== "object") return null;
  const document = value as { version?: unknown; reviewStore?: unknown };
  if (typeof document.version !== "number" || !Number.isInteger(document.version) || document.version < 0) return null;
  if (!document.reviewStore || typeof document.reviewStore !== "object" || Array.isArray(document.reviewStore)) return null;
  return { version: document.version, reviewStore: document.reviewStore as ReviewStore };
}
