import { describe, expect, it } from "vitest";
import {
  conciseVocabularyLimits,
  createFingerprint,
  hasDriveConflict,
  isConciseVocabularyEntry,
  isFreeOnlyModel,
  mergeVocabularyEntries,
  normalizeWords,
  parseVocabularyMarkdown,
  renderVocabularyMarkdown,
  requestWithFreeFallback,
} from "./vocabulary";

describe("vocabulary helpers", () => {
  it("normalizes batch input and removes duplicates", () => {
    expect(normalizeWords("Serenity, grit\nserenity\n  epiphany ")).toEqual([
      "Serenity",
      "grit",
      "epiphany",
    ]);
  });

  it("renders and parses the established three-column Markdown table", () => {
    const markdown = renderVocabularyMarkdown([
      {
        id: "serenity-1",
        word: "Serenity",
        meaning: "A calm and peaceful state",
        example: "The garden gave her serenity.",
        createdAt: 0,
      },
    ]);

    expect(markdown).toContain("| Word or Phrase | Simple Meaning | Example |");
    expect(parseVocabularyMarkdown(markdown)).toMatchObject([
      { word: "Serenity", meaning: "A calm and peaceful state" },
    ]);
  });

  it("prevents duplicate words during a merge", () => {
    const result = mergeVocabularyEntries(
      [{ id: "1", word: "serenity", meaning: "calm", example: "Example.", createdAt: 0 }],
      [
        { id: "2", word: "Serenity", meaning: "calm", example: "Example.", createdAt: 0 },
        { id: "3", word: "Grit", meaning: "courage", example: "Example.", createdAt: 0 },
      ],
    );

    expect(result.entries).toHaveLength(2);
    expect(result.duplicates).toEqual(["Serenity"]);
  });

  it("changes the fingerprint when the Drive content changes", () => {
    expect(createFingerprint("first revision")).toBe(createFingerprint("first revision"));
    expect(createFingerprint("first revision")).not.toBe(createFingerprint("edited revision"));
  });

  it("flags a changed Drive revision or file body before sync", () => {
    const expected = { version: "12", fingerprint: createFingerprint("saved file") };
    expect(hasDriveConflict(expected, { version: "12", content: "saved file" })).toBe(false);
    expect(hasDriveConflict(expected, { version: "13", content: "saved file" })).toBe(true);
    expect(hasDriveConflict(expected, { version: "12", content: "edited in Obsidian" })).toBe(true);
  });

  it("tries another free model when the first one is unavailable and never calls paid model IDs", async () => {
    const called: string[] = [];
    const result = await requestWithFreeFallback(
      async model => {
        called.push(model);
        if (model === "openrouter/free") throw new Error("temporary outage");
        return "generated";
      },
      ["openrouter/free", "nvidia/nemotron-3.5-lightning:free", "paid/provider-model"],
    );

    expect(result).toEqual({ value: "generated", model: "nvidia/nemotron-3.5-lightning:free" });
    expect(called).toEqual(["openrouter/free", "nvidia/nemotron-3.5-lightning:free"]);
    expect(isFreeOnlyModel("paid/provider-model")).toBe(false);
  });

  it("accepts compact vocabulary notes and rejects overlong model output", () => {
    expect(isConciseVocabularyEntry({
      word: "hypothesis",
      meaning: "A testable idea based on evidence.",
      example: "The researcher tested her hypothesis.",
    })).toBe(true);

    expect(isConciseVocabularyEntry({
      word: "hypothesis",
      meaning: "A proposed explanation based on limited evidence that can be tested through observation.",
      example: "The researcher formed a hypothesis that adding fertilizer would increase crop yield.",
    })).toBe(false);
    expect(conciseVocabularyLimits.meaningWords).toBe(8);
    expect(conciseVocabularyLimits.exampleWords).toBe(10);
  });
});
