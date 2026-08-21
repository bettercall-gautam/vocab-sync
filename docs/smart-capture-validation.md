# Smart Capture Validation

## Diagnosed cause

The primary Free Dictionary API intermittently returned HTTP 502 responses for otherwise valid entries. When that happened, Vocab Sync used the Wiktionary fallback. Wiktionary's response contains HTML and metadata elements, and the previous cleaner only understood a small amount of Markdown. That allowed raw `mw:WikiLink` and `usage-label-sense` markup to reach draft fields.

Direct response checks on 2026-08-21 confirmed that `adore`, `serenity`, `owl`, `problem`, and `why` all have valid dictionary content. The corrected parser strips HTML, decodes common entities, rejects non-English senses when Wiktionary labels them, and ranks a real definition with an example above metadata or inflection-only text.

## Universal capture policy

Smart capture handles one ordinary Latin-script word with the no-key English dictionary first. It sends phrases, batches, and non-Latin-script input to the existing free AI route. An unfamiliar Latin-script word such as a French term may attempt the dictionary first, but a dictionary miss immediately falls through to AI. If either route cannot complete because the device is offline, the key is missing, or the free provider is at capacity, it creates editable manual drafts prefilled with the submitted input. No submitted input is discarded.

## Automated and visual checks

The local suite passed 47 tests across 10 files. TypeScript validation and the production static build passed. Desktop and 375 pixel mobile screenshots show the Smart, Manual, and AI choices clearly, with no horizontal overflow. Owner-device testing remains required for live OpenRouter behavior because the API key exists only in the owner's browser.
