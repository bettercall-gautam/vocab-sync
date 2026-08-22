export type VocabularyEntry = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  createdAt: number;
  source?: "dictionary" | "ai" | "manual" | "imported" | "needs-review";
};

export type GeneratedVocabularyText = {
  word: string;
  meaning: string;
  example: string;
};

export const conciseVocabularyLimits = {
  meaningWords: 18,
  exampleWords: 28,
} as const;

export type DriveFileSnapshot = {
  id: string;
  name: string;
  version: string;
  modifiedTime: string;
  content: string;
};

const dividerPattern = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;

export function normalizeVocabularyWord(value: string): string {
  const trimmed = value.trim();
  const outerBoldMatch = trimmed.match(/^\*\*([\s\S]+?)\*\*$/);
  return (outerBoldMatch?.[1] ?? trimmed).trim();
}

export function normalizeWords(input: string): string[] {
  const seen = new Set<string>();

  return input
    .split(/[\n,;]+/)
    .map(word => normalizeVocabularyWord(word.trim().replace(/^[-•\d.\s]+/, "")))
    .filter(Boolean)
    .filter(word => {
      const normalized = word.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

/**
 * The free dictionary sources only work reliably for one simple Latin-script word.
 * Phrases and other scripts should go straight to AI; unfamiliar Latin words can still
 * attempt the dictionary and then fall through to AI when no clean entry exists.
 */
export function isOrdinaryEnglishDictionaryWord(value: string): boolean {
  return /^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(value.trim());
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
    const [rawWord = "", meaning = "", example = ""] = cellsFromRow(line);
    const word = normalizeVocabularyWord(rawWord);
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
    .map(entry => `| ${escapeCell(normalizeVocabularyWord(entry.word))} | ${escapeCell(entry.meaning)} | ${escapeCell(entry.example)} |`)
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

function normalizeVocabularyText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Keeps provider output clean without ever slicing a meaning or example in the
 * middle of a sentence. The model prompt still asks for short notes, while the
 * wider validation ceiling accepts a complete slightly longer response.
 */
export function clampVocabularyEntryToConciseLimits(entry: GeneratedVocabularyText): GeneratedVocabularyText {
  return {
    ...entry,
    meaning: normalizeVocabularyText(entry.meaning),
    example: normalizeVocabularyText(entry.example),
  };
}

type DictionaryDefinition = {
  definition?: unknown;
  example?: unknown;
};

type DictionaryMeaning = {
  partOfSpeech?: unknown;
  definitions?: unknown;
};

type WiktionaryDefinition = {
  definition?: unknown;
  examples?: unknown;
  parsedExamples?: unknown;
};

type WiktionarySense = {
  partOfSpeech?: unknown;
  language?: unknown;
  definitions?: unknown;
};

function fallbackDictionaryExample(word: string, partOfSpeech: string): string {
  if (partOfSpeech === "adjective") return `The ${word} moment passed.`;
  if (partOfSpeech === "verb") return `They ${word} the plan.`;
  if (partOfSpeech === "adverb") return `She spoke ${word}.`;
  return `The ${word} mattered.`;
}

/**
 * Converts the public Free Dictionary API response into the app's existing three-column
 * format. It is deliberately limited to direct, ordinary-word lookup rather than AI
 * generation, so it continues to work without an OpenRouter key or free-model quota.
 */
export function parseInstantDictionaryEntry(payload: unknown, requestedWord: string): GeneratedVocabularyText {
  const records = Array.isArray(payload) ? payload : [];
  const candidates: Array<{ meaning: string; example: string | null; partOfSpeech: string }> = [];

  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const meanings = (record as { meanings?: unknown }).meanings;
    if (!Array.isArray(meanings)) continue;

    for (const meaning of meanings) {
      if (!meaning || typeof meaning !== "object") continue;
      const rawPartOfSpeech = (meaning as DictionaryMeaning).partOfSpeech;
      const partOfSpeech = typeof rawPartOfSpeech === "string"
        ? rawPartOfSpeech.toLocaleLowerCase()
        : "";
      const definitions = (meaning as DictionaryMeaning).definitions;
      if (!Array.isArray(definitions)) continue;

      for (const definition of definitions) {
        if (!definition || typeof definition !== "object") continue;
        const meaningText = (definition as DictionaryDefinition).definition;
        if (typeof meaningText !== "string" || !meaningText.trim()) continue;
        const exampleText = (definition as DictionaryDefinition).example;
        candidates.push({
          meaning: meaningText.trim(),
          example: typeof exampleText === "string" && exampleText.trim() ? exampleText.trim() : null,
          partOfSpeech,
        });
      }
    }
  }

  const selected = candidates.find(candidate => candidate.example) ?? candidates[0];
  if (selected) {
    return clampVocabularyEntryToConciseLimits({
      word: requestedWord.trim(),
      meaning: selected.meaning,
      example: selected.example ?? fallbackDictionaryExample(requestedWord.trim(), selected.partOfSpeech),
    });
  }

  throw new Error("The instant dictionary could not find a simple definition for this word. Try AI generation or add it manually.");
}

function cleanWiktionaryText(value: string): string {
  const decoded = value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));

  return decoded
    .replace(/^\s*\[+/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function firstWiktionaryExample(value: unknown): string | null {
  if (typeof value === "string" && cleanWiktionaryText(value)) return cleanWiktionaryText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && cleanWiktionaryText(item)) return cleanWiktionaryText(item);
      if (item && typeof item === "object" && typeof (item as { example?: unknown }).example === "string") {
        const cleaned = cleanWiktionaryText((item as { example: string }).example);
        if (cleaned) return cleaned;
      }
    }
  }
  if (value && typeof value === "object" && typeof (value as { example?: unknown }).example === "string") {
    const cleaned = cleanWiktionaryText((value as { example: string }).example);
    if (cleaned) return cleaned;
  }
  return null;
}

function isInflectionOnlyDefinition(value: string): boolean {
  return /\b(inflection|present participle|past tense|past participle|plural|gerund|alternative form|form of)\b/i.test(value);
}

/**
 * Parses the public English Wiktionary definition endpoint as a second dictionary
 * source. It is used only after the primary no-key dictionary source cannot help.
 */
export function parseWiktionaryDictionaryEntry(payload: unknown, requestedWord: string): GeneratedVocabularyText {
  const englishSenses = payload && typeof payload === "object"
    ? (payload as { en?: unknown }).en
    : null;
  if (!Array.isArray(englishSenses)) {
    throw new Error("The secondary dictionary did not return an English definition.");
  }

  const candidates: Array<{ meaning: string; example: string | null; partOfSpeech: string }> = [];
  for (const sense of englishSenses) {
    if (!sense || typeof sense !== "object") continue;
    const rawLanguage = (sense as WiktionarySense).language;
    if (typeof rawLanguage === "string" && rawLanguage.toLocaleLowerCase() !== "english") continue;
    const rawPartOfSpeech = (sense as WiktionarySense).partOfSpeech;
    const partOfSpeech = typeof rawPartOfSpeech === "string" ? rawPartOfSpeech.toLocaleLowerCase() : "";
    const rawDefinitions = (sense as WiktionarySense).definitions;
    const definitions = Array.isArray(rawDefinitions) ? rawDefinitions : [rawDefinitions];

    for (const definition of definitions) {
      if (!definition || typeof definition !== "object") continue;
      const text = (definition as WiktionaryDefinition).definition;
      const meaning = typeof text === "string" ? cleanWiktionaryText(text) : "";
      if (!meaning || !/[A-Za-z]/.test(meaning)) continue;
      const example = firstWiktionaryExample((definition as WiktionaryDefinition).examples)
        ?? firstWiktionaryExample((definition as WiktionaryDefinition).parsedExamples)
        ?? null;
      candidates.push({ meaning, example, partOfSpeech });
    }
  }

  const selected = [...candidates].sort((left, right) => {
    const score = (candidate: { meaning: string; example: string | null }) => (
      (candidate.example ? 3 : 0)
      + (isInflectionOnlyDefinition(candidate.meaning) ? -4 : 1)
      + (candidate.meaning.split(/\s+/).length >= 3 ? 1 : 0)
    );
    return score(right) - score(left);
  })[0];
  if (selected) {
    return clampVocabularyEntryToConciseLimits({
      word: requestedWord.trim(),
      meaning: selected.meaning,
      example: selected.example ?? fallbackDictionaryExample(requestedWord.trim(), selected.partOfSpeech),
    });
  }

  throw new Error("The secondary dictionary could not find a simple English definition.");
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

function isAccountFreeModelDailyLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /free[- ]models[- ]per[- ]day|free model.*requests? per day/i.test(message);
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
        if (isAccountFreeModelDailyLimit(error)) {
          throw new Error(
            "OpenRouter's daily free-model limit has been reached. Add a manual draft now, then retry after OpenRouter resets the limit. No paid model was used. Your words are still safe.",
          );
        }
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
