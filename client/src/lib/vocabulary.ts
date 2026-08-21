export type VocabularyEntry = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  createdAt: number;
};

export type GeneratedVocabularyText = {
  word: string;
  meaning: string;
  example: string;
};

export const conciseVocabularyLimits = {
  meaningWords: 8,
  exampleWords: 10,
} as const;

export type DriveFileSnapshot = {
  id: string;
  name: string;
  version: string;
  modifiedTime: string;
  content: string;
};

const dividerPattern = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;

export function normalizeWords(input: string): string[] {
  const seen = new Set<string>();

  return input
    .split(/[\n,;]+/)
    .map(word => word.trim().replace(/^[-•\d.\s]+/, ""))
    .filter(Boolean)
    .filter(word => {
      const normalized = word.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function cellsFromRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(cell => cell.trim().replace(/\\\|/g, "|"));
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

export function parseVocabularyMarkdown(markdown: string): VocabularyEntry[] {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => {
    const cells = cellsFromRow(line).map(cell => cell.toLocaleLowerCase());
    return cells.length >= 3 && cells[0].includes("word") && cells[1].includes("meaning");
  });

  if (headerIndex === -1) return [];

  const entries: VocabularyEntry[] = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes("|") || dividerPattern.test(line)) continue;
    const [word = "", meaning = "", example = ""] = cellsFromRow(line);
    if (!word || !meaning || !example) continue;
    entries.push({
      id: `${word.toLocaleLowerCase()}-${index}`,
      word,
      meaning,
      example,
      createdAt: 0,
    });
  }

  return entries;
}

export function renderVocabularyMarkdown(entries: VocabularyEntry[]): string {
  const rows = entries
    .map(entry => `| ${escapeCell(entry.word)} | ${escapeCell(entry.meaning)} | ${escapeCell(entry.example)} |`)
    .join("\n");

  return [
    "# Vocabulary",
    "",
    "| Word or Phrase | Simple Meaning | Example |",
    "|---|---|---|",
    rows,
    "",
  ].join("\n");
}

export function createFingerprint(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fp-${(hash >>> 0).toString(16)}`;
}

export function hasDriveConflict(
  expected: { version: string; fingerprint: string },
  latest: { version: string; content: string },
): boolean {
  return expected.version !== latest.version || expected.fingerprint !== createFingerprint(latest.content);
}

// Reassessed against OpenRouter's live catalog on 2026-08-21 for short structured
// vocabulary notes. These durable models are free and support structured outputs.
// The first model is tuned for lower-latency inference; the second is a free backup.
export const freeModelFallbacks = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-20b:free",
] as const;

export const openRouterModelsPerRequestLimit = 3;

export function isFreeOnlyModel(model: string): boolean {
  return model === "openrouter/free" || model.endsWith(":free");
}

export function groupFreeModelsForOpenRouter(
  models: readonly string[],
  maximumPerRequest = openRouterModelsPerRequestLimit,
): string[][] {
  if (!Number.isInteger(maximumPerRequest) || maximumPerRequest < 1) {
    throw new Error("OpenRouter model group size must be at least one.");
  }

  const groups: string[][] = [];
  for (let index = 0; index < models.length; index += maximumPerRequest) {
    groups.push(models.slice(index, index + maximumPerRequest));
  }
  return groups;
}

/**
 * Accept either a raw OpenRouter key or a value copied from an HTTP example.
 * Whitespace and an accidental Bearer prefix are not part of the API key.
 */
export function normalizeOpenRouterApiKey(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function isConciseVocabularyEntry(entry: GeneratedVocabularyText): boolean {
  return Boolean(
    entry.word.trim()
    && entry.meaning.trim()
    && entry.example.trim()
    && countWords(entry.meaning) <= conciseVocabularyLimits.meaningWords
    && countWords(entry.example) <= conciseVocabularyLimits.exampleWords,
  );
}

function trimToWordLimit(value: string, limit: number): string {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, limit).join(" ");
}

/**
 * Keeps the user-requested short format locally rather than issuing a second,
 * slower model request when a provider slightly exceeds a word limit.
 */
export function clampVocabularyEntryToConciseLimits(entry: GeneratedVocabularyText): GeneratedVocabularyText {
  return {
    ...entry,
    meaning: trimToWordLimit(entry.meaning, conciseVocabularyLimits.meaningWords),
    example: trimToWordLimit(entry.example, conciseVocabularyLimits.exampleWords),
  };
}

export function parseGeneratedVocabularyEntries(content: unknown): GeneratedVocabularyText[] {
  if (typeof content !== "string" || !content.trim()) throw new Error("Model response was empty.");

  const json = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Model response was not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { entries?: unknown }).entries)) {
    throw new Error("Model response did not contain vocabulary entries.");
  }

  const entries = (parsed as { entries: unknown[] }).entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map(entry => ({
      word: typeof entry.word === "string" ? entry.word.trim() : "",
      meaning: typeof entry.meaning === "string" ? entry.meaning.trim() : "",
      example: typeof entry.example === "string" ? entry.example.trim() : "",
    }))
    .filter(entry => Boolean(entry.word && entry.meaning && entry.example));

  if (!entries.length) throw new Error("Model response did not contain usable vocabulary entries.");
  return entries;
}

export function hasSyncableVocabularyChanges(drafts: VocabularyEntry[], libraryDirty: boolean): boolean {
  return libraryDirty || drafts.some(entry => Boolean(entry.word.trim() && entry.meaning.trim() && entry.example.trim()));
}

export type FreeModelRouterResult<T> = {
  value: T;
  attempts: number;
  candidates: string[];
};

function isRetryableFreeModelFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(408|409|425|429|500|502|503|504)\b|network|timeout|temporar|busy|overload|empty|not valid json|did not contain vocabulary|usable vocabulary|did not return every requested word/i.test(message);
}

function shouldRetryWithoutDelay(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /empty|not valid json|did not contain vocabulary|usable vocabulary/i.test(message);
}

function conciseFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 180) || "Unknown OpenRouter error";
}

/**
 * Sends one explicit free-only model at a time. A malformed or empty successful HTTP
 * response is model-specific, so the next verified free model is tried immediately
 * instead of repeating the same broken output format.
 */
export async function requestWithFreeModelRouter<T>(
  request: (models: readonly string[]) => Promise<T>,
  models: readonly string[] = freeModelFallbacks,
  retryDelayMs = 350,
): Promise<FreeModelRouterResult<T>> {
  const candidates = models.filter(isFreeOnlyModel);
  if (!candidates.length) throw new Error("No free model candidates are configured.");

  let lastError: unknown;
  let attempts = 0;
  for (const model of candidates) {
    for (let retry = 0; retry <= 1; retry += 1) {
      attempts += 1;
      try {
        return { value: await request([model]), attempts, candidates };
      } catch (error) {
        lastError = error;
        if (!isRetryableFreeModelFailure(error)) {
          throw new Error(
            `Free generation could not run after ${candidates.length} verified free models. ${conciseFailureReason(error)}. Your words are still safe.`,
          );
        }
        if (shouldRetryWithoutDelay(error)) break;
        if (retry === 0 && retryDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }
  }

  throw new Error(
    `Free generation could not run after ${candidates.length} verified free models. ${conciseFailureReason(lastError)}. Your words are still safe.`,
  );
}

export function mergeVocabularyEntries(
  existing: VocabularyEntry[],
  incoming: VocabularyEntry[],
): { entries: VocabularyEntry[]; duplicates: string[] } {
  const known = new Set(existing.map(entry => entry.word.trim().toLocaleLowerCase()));
  const duplicates: string[] = [];
  const additions = incoming.filter(entry => {
    const key = entry.word.trim().toLocaleLowerCase();
    if (known.has(key)) {
      duplicates.push(entry.word);
      return false;
    }
    known.add(key);
    return true;
  });

  return { entries: [...existing, ...additions], duplicates };
}
