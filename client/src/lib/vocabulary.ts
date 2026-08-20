export type VocabularyEntry = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  createdAt: number;
};

export type DriveFileSnapshot = {
  id: string;
  name: string;
  version: string;
  modifiedTime: string;
  content: string;
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

export const freeModelFallbacks = [
  "openrouter/free",
  "nvidia/nemotron-3.5-lightning:free",
  "z-ai/glm-5.2:free",
  "google/gemma-4-31b-it:free",
] as const;

export function isFreeOnlyModel(model: string): boolean {
  return model === "openrouter/free" || model.endsWith(":free");
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

export function hasSyncableVocabularyChanges(drafts: VocabularyEntry[], libraryDirty: boolean): boolean {
  return libraryDirty || drafts.some(entry => Boolean(entry.word.trim() && entry.meaning.trim() && entry.example.trim()));
}

export async function requestWithFreeFallback<T>(
  request: (model: string) => Promise<T>,
  models: readonly string[] = freeModelFallbacks,
): Promise<{ value: T; model: string }> {
  const attempted: string[] = [];
  for (const model of models) {
    if (!isFreeOnlyModel(model)) continue;
    attempted.push(model);
    try {
      return { value: await request(model), model };
    } catch {
      // Free providers can be temporarily full or unavailable. Try the next free model only.
    }
  }
  throw new Error(`No free model is available right now. Tried ${attempted.length} free options.`);
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
