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

// Verified against OpenRouter's public catalog on 2026-08-20. Every model is free
// and advertises structured-output support, unlike the previous generic router chain.
export const freeModelFallbacks = [
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
  "z-ai/glm-5.2:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
] as const;

export function isFreeOnlyModel(model: string): boolean {
  return model === "openrouter/free" || model.endsWith(":free");
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
  return /\b(408|409|425|429|500|502|503|504)\b|network|timeout|temporar|busy|overload|not valid json|usable vocabulary|did not return every requested word/i.test(message);
}

function conciseFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 180) || "Unknown OpenRouter error";
}

/**
 * Sends one request with explicit free-only model fallbacks. OpenRouter can pick the
 * fastest compatible free endpoint, avoiding a slow sequence of browser-side requests.
 * A single short retry is reserved for transient capacity and network errors.
 */
export async function requestWithFreeModelRouter<T>(
  request: (models: readonly string[]) => Promise<T>,
  models: readonly string[] = freeModelFallbacks,
  retryDelayMs = 350,
): Promise<FreeModelRouterResult<T>> {
  const candidates = models.filter(isFreeOnlyModel);
  if (!candidates.length) throw new Error("No free model candidates are configured.");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return { value: await request(candidates), attempts: attempt, candidates };
    } catch (error) {
      lastError = error;
      if (attempt === 2 || !isRetryableFreeModelFailure(error)) break;
      if (retryDelayMs > 0) await new Promise(resolve => window.setTimeout(resolve, retryDelayMs));
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
