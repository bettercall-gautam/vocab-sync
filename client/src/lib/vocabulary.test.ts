import { describe, expect, it } from "vitest";
import {
  clampVocabularyEntryToConciseLimits,
  conciseVocabularyLimits,
  createFingerprint,
  groupFreeModelsForOpenRouter,
  hasSyncableVocabularyChanges,
  hasDriveConflict,
  isOrdinaryEnglishDictionaryWord,
  isConciseVocabularyEntry,
  isFreeOnlyModel,
  mergeVocabularyEntries,
  normalizeOpenRouterApiKey,
  normalizeVocabularyWord,
  normalizeWords,
  parseGeneratedVocabularyEntries,
  parseInstantDictionaryEntry,
  parseWiktionaryDictionaryEntry,
  parseVocabularyMarkdown,
  freeModelFallbacks,
  renderVocabularyMarkdown,
  requestWithFreeModelRouter,
} from "./vocabulary";

describe("vocabulary helpers", () => {
  it("normalizes batch input and removes duplicates", () => {
    expect(normalizeWords("Serenity, grit\nserenity\n  epiphany ")).toEqual([
      "Serenity",
      "grit",
      "epiphany",
    ]);
  });

  it("removes only outer Markdown bold markers from vocabulary words", () => {
    expect(normalizeVocabularyWord(" **serenity** ")).toBe("serenity");
    expect(normalizeVocabularyWord("aster*isk")).toBe("aster*isk");
    expect(normalizeWords("**serenity**, grit")).toEqual(["serenity", "grit"]);
  });

  it("turns a public dictionary definition and example into a concise vocabulary draft", () => {
    expect(parseInstantDictionaryEntry([
      {
        meanings: [{
          partOfSpeech: "adjective",
          definitions: [{
            definition: "Lasting only a short period of time.",
            example: "Fame can be ephemeral.",
          }],
        }],
      },
    ], "ephemeral")).toEqual({
      word: "ephemeral",
      meaning: "Lasting only a short period of time.",
      example: "Fame can be ephemeral.",
    });
  });

  it("uses a short editable sentence when a public dictionary lacks an example", () => {
    expect(parseInstantDictionaryEntry([
      {
        meanings: [{
          partOfSpeech: "adjective",
          definitions: [{ definition: "Lasting for a short period of time." }],
        }],
      },
    ], "ephemeral").example).toBe("The ephemeral moment passed.");
  });

  it("prefers a primary dictionary definition with a real example over an earlier bare definition", () => {
    expect(parseInstantDictionaryEntry([
      {
        meanings: [{
          partOfSpeech: "verb",
          definitions: [
            { definition: "To worship." },
            {
              definition: "To love with one's entire heart and soul; regard with deep respect.",
              example: "Gerry adores Heather.",
            },
          ],
        }],
      },
    ], "adore")).toEqual({
      word: "adore",
      meaning: "To love with one's entire heart and soul; regard with deep respect.",
      example: "Gerry adores Heather.",
    });
  });

  it("keeps a complete slightly longer Smart-dictionary example instead of cutting it at a word limit", () => {
    expect(parseInstantDictionaryEntry([
      {
        meanings: [{
          partOfSpeech: "noun",
          definitions: [{
            definition: "A fortunate discovery made by accident.",
            example: "Finding the quiet café by accident was pure serendipity on our rainy afternoon walk.",
          }],
        }],
      },
    ], "serendipity")).toEqual({
      word: "serendipity",
      meaning: "A fortunate discovery made by accident.",
      example: "Finding the quiet café by accident was pure serendipity on our rainy afternoon walk.",
    });
  });

  it("parses a Wiktionary common-word response as a second no-key dictionary source", () => {
    expect(parseWiktionaryDictionaryEntry({
      en: [{
        partOfSpeech: "Adjective",
        definitions: [{
          definition: " Very beautiful.",
          examples: ["The sunsets in Hawaii are **gorgeous**."],
        }],
      }],
    }, "gorgeous")).toEqual({
      word: "gorgeous",
      meaning: "Very beautiful.",
      example: "The sunsets in Hawaii are gorgeous.",
    });
  });

  it("strips raw Wiktionary HTML and skips a non-English label before selecting an English definition", () => {
    expect(parseWiktionaryDictionaryEntry({
      en: [
        {
          language: "Translingual",
          partOfSpeech: "Symbol",
          definitions: [{
            definition: '<span class="usage-label-sense" about="#mwt4"></span> ISO language code for Old Welsh.',
          }],
        },
        {
          language: "English",
          partOfSpeech: "Noun",
          definitions: [{
            definition: '<span class="usage-label-sense"></span> Any <a rel="mw:WikiLink" href="/wiki/bird">bird</a> of prey.',
            parsedExamples: [{ example: 'The <b>owl</b> watched quietly<span typeof="mw:Entity">.</span>' }],
          }],
        },
      ],
    }, "owl")).toEqual({
      word: "owl",
      meaning: "Any bird of prey.",
      example: "The owl watched quietly.",
    });
  });

  it("ranks an actual word sense above a Wiktionary inflection-only label", () => {
    expect(parseWiktionaryDictionaryEntry({
      en: [{
        language: "English",
        partOfSpeech: "Verb",
        definitions: [{ definition: "present participle and gerund of adore" }],
      }, {
        language: "English",
        partOfSpeech: "Adjective",
        definitions: [{ definition: "Showing adoration or admiration." }],
      }],
    }, "adoring")).toEqual({
      word: "adoring",
      meaning: "Showing adoration or admiration.",
      example: "The adoring moment passed.",
    });
  });

  it("recognizes only one simple Latin-script word for a direct dictionary attempt", () => {
    expect(isOrdinaryEnglishDictionaryWord("adore")).toBe(true);
    expect(isOrdinaryEnglishDictionaryWord("adoring")).toBe(true);
    expect(isOrdinaryEnglishDictionaryWord("in the mood for love")).toBe(false);
    expect(isOrdinaryEnglishDictionaryWord("bonjour")).toBe(true);
    expect(isOrdinaryEnglishDictionaryWord("你好")).toBe(false);
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

  it("reads old bold words plainly and writes future word cells without bold markers", () => {
    const entries = parseVocabularyMarkdown([
      "| Word or Phrase | Simple Meaning | Example |",
      "|---|---|---|",
      "| **serenity** | Calm peace | The room felt calm. |",
    ].join("\n"));

    expect(entries[0]).toMatchObject({ word: "serenity", meaning: "Calm peace", example: "The room felt calm." });
    expect(renderVocabularyMarkdown([{ ...entries[0], word: "**serenity**" }])).toContain("| serenity | Calm peace | The room felt calm. |");
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

  it("uses durable verified free candidates and excludes the random free-model router", () => {
    expect(freeModelFallbacks.length).toBeGreaterThanOrEqual(2);
    expect(freeModelFallbacks.every(isFreeOnlyModel)).toBe(true);
    expect(freeModelFallbacks).not.toContain("openrouter/free");
    expect(freeModelFallbacks).toEqual([
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-3.5-lightning:free",
      "minimax/minimax-m3:free",
    ]);
    expect(isFreeOnlyModel("paid/provider-model")).toBe(false);
  });

  it("splits five free candidates into OpenRouter-compatible groups of at most three", () => {
    expect(groupFreeModelsForOpenRouter(["one:free", "two:free", "three:free", "four:free", "five:free"]))
      .toEqual([["one:free", "two:free", "three:free"], ["four:free", "five:free"]]);
  });

  it("normalizes a raw or accidentally prefixed OpenRouter key without exposing its value", () => {
    expect(normalizeOpenRouterApiKey("  sk-or-v1-example  ")).toBe("sk-or-v1-example");
    expect(normalizeOpenRouterApiKey("Bearer sk-or-v1-example\n")).toBe("sk-or-v1-example");
  });

  it("retries one transient multi-model request while preserving the complete free candidate list", async () => {
    const calls: string[][] = [];
    const result = await requestWithFreeModelRouter(
      async models => {
        calls.push([...models]);
        if (calls.length === 1) throw new Error("OpenRouter 429: capacity temporarily busy");
        return "generated";
      },
      ["first:free", "second:free", "paid/provider-model"],
      0,
    );

    expect(result).toEqual({
      value: "generated",
      attempts: 2,
      candidates: ["first:free", "second:free"],
    });
    expect(calls).toEqual([["first:free"], ["first:free"]]);
  });

  it("uses the next free model only after a retryable first model is exhausted", async () => {
    const calls: string[][] = [];
    const result = await requestWithFreeModelRouter(
      async models => {
        calls.push([...models]);
        if (models.includes("first:free")) throw new Error("OpenRouter 503: temporarily busy");
        return "generated by overflow group";
      },
      ["first:free", "second:free", "third:free", "fourth:free", "fifth:free"],
      0,
    );

    expect(result.value).toBe("generated by overflow group");
    expect(result.attempts).toBe(3);
    expect(calls).toEqual([
      ["first:free"],
      ["first:free"],
      ["second:free"],
    ]);
  });

  it("moves from malformed free-model output directly to the next candidate", async () => {
    const calls: string[][] = [];
    const result = await requestWithFreeModelRouter(
      async models => {
        calls.push([...models]);
        if (models[0] === "first:free") throw new Error("Model response was not valid JSON.");
        return "repaired";
      },
      ["first:free", "second:free"],
      0,
    );

    expect(result.value).toBe("repaired");
    expect(result.attempts).toBe(2);
    expect(calls).toEqual([["first:free"], ["second:free"]]);
  });

  it("advances from an empty model response to the next free-only candidate without a delay", async () => {
    const calls: string[][] = [];
    const result = await requestWithFreeModelRouter(
      async models => {
        calls.push([...models]);
        if (models.includes("first:free")) throw new Error("Model response was empty.");
        return "recovered";
      },
      ["first:free", "second:free", "third:free", "fourth:free"],
      0,
    );

    expect(result.value).toBe("recovered");
    expect(calls).toEqual([
      ["first:free"],
      ["second:free"],
    ]);
  });

  it("keeps an authentication failure specific instead of wasting a retry", async () => {
    await expect(requestWithFreeModelRouter(
      async () => { throw new Error("OpenRouter 401: invalid API key"); },
      ["only:free"],
      0,
    )).rejects.toThrow("OpenRouter 401: invalid API key");
  });

  it("stops immediately when OpenRouter has reached the account-level daily free-model cap", async () => {
    const calls: string[][] = [];
    await expect(requestWithFreeModelRouter(
      async models => {
        calls.push([...models]);
        throw new Error("OpenRouter 429 (429): Rate limit exceeded: free-models-per-day");
      },
      ["first:free", "second:free"],
      0,
    )).rejects.toThrow("daily free-model limit has been reached");
    expect(calls).toEqual([["first:free"]]);
  });

  it("salvages vocabulary entries from malformed JSON text using per-entry regex", () => {
    const malformed = 'Sure, here are the entries: {"word": "serenity", "meaning": "calmness", "example": "A sense of serenity."} and another one {"word": "grit", "meaning": "courage", "example": "He showed true grit."}';
    expect(parseGeneratedVocabularyEntries(malformed)).toEqual([
      { word: "serenity", meaning: "calmness", example: "A sense of serenity." },
      { word: "grit", meaning: "courage", example: "He showed true grit." },
    ]);
  });

  it("salvages entries from a JSON array with trailing commas", () => {
    const malformed = '```json\n[{"word": "serenity", "meaning": "calm", "example": "Peace.",},]\n```';
    expect(parseGeneratedVocabularyEntries(malformed)).toEqual([
      { word: "serenity", meaning: "calm", example: "Peace." },
    ]);
  });

  it("advances to the next free candidate when a model is no longer available for free", async () => {
    const calls: string[][] = [];
    const result = await requestWithFreeModelRouter(
      async models => {
        calls.push([...models]);
        if (models.includes("first:free")) {
          throw new Error("OpenRouter 404 (404): This model is unavailable for free. The paid version is available now - use this slug instead: first-model");
        }
        return "recovered from paid-only model";
      },
      ["first:free", "second:free"],
      0,
    );

    expect(result.value).toBe("recovered from paid-only model");
    expect(calls).toEqual([
      ["first:free"],
      ["second:free"],
    ]);
  });

  it("accepts complete slightly longer vocabulary notes and rejects genuinely excessive model output", () => {
    expect(isConciseVocabularyEntry({
      word: "hypothesis",
      meaning: "A testable idea based on evidence.",
      example: "The researcher tested her hypothesis.",
    })).toBe(true);

    expect(isConciseVocabularyEntry({
      word: "hypothesis",
      meaning: "A proposed explanation based on limited evidence that can be tested through observation.",
      example: "The researcher formed a hypothesis that adding fertilizer would increase crop yield.",
    })).toBe(true);

    expect(isConciseVocabularyEntry({
      word: "hypothesis",
      meaning: "A proposed explanation formed from limited observations and evidence that must be tested carefully through repeated experiments before it can support a reliable conclusion.",
      example: "The research team formed a detailed hypothesis about how changing several environmental conditions together could affect plant growth across many carefully controlled experiments during the season.",
    })).toBe(false);
    expect(conciseVocabularyLimits.meaningWords).toBe(18);
    expect(conciseVocabularyLimits.exampleWords).toBe(28);
  });

  it("keeps a slightly overlong provider response complete instead of cutting it mid-sentence", () => {
    expect(clampVocabularyEntryToConciseLimits({
      word: "hypothesis",
      meaning: "A proposed explanation based on limited evidence that can be tested.",
      example: "The researcher formed a hypothesis that adding fertilizer would increase crop yield.",
    })).toEqual({
      word: "hypothesis",
      meaning: "A proposed explanation based on limited evidence that can be tested.",
      example: "The researcher formed a hypothesis that adding fertilizer would increase crop yield.",
    });

    expect(clampVocabularyEntryToConciseLimits({
      word: "serendipity",
      meaning: "  A   lucky   discovery made by chance.  ",
      example: "  We found the quiet café by serendipity after getting lost.  ",
    })).toEqual({
      word: "serendipity",
      meaning: "A lucky discovery made by chance.",
      example: "We found the quiet café by serendipity after getting lost.",
    });
  });

  it("parses valid JSON even when a free model wraps it in a Markdown fence", () => {
    expect(parseGeneratedVocabularyEntries("```json\n{\"entries\":[{\"word\":\"test\",\"meaning\":\"A check.\",\"example\":\"We took a test.\"}]}\n```"))
      .toEqual([{ word: "test", meaning: "A check.", example: "We took a test." }]);
  });

  it("rejects malformed or empty free-model output so another free model can be tried", () => {
    expect(() => parseGeneratedVocabularyEntries("not JSON")).toThrow("not valid JSON");
    expect(() => parseGeneratedVocabularyEntries('{"entries":[]}')).toThrow("usable vocabulary entries");
  });

  it("allows a sync after a Library edit or deletion even with no new drafts", () => {
    expect(hasSyncableVocabularyChanges([], true)).toBe(true);
    expect(hasSyncableVocabularyChanges([], false)).toBe(false);
    expect(hasSyncableVocabularyChanges([
      { id: "draft-1", word: "hypothesis", meaning: "A testable idea.", example: "We tested the hypothesis.", createdAt: 0 },
    ], false)).toBe(true);
  });
});
