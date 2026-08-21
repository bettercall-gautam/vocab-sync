# Multilingual Capture Research

## Goal

Vocab Sync needs a low-latency way to capture a word or phrase in many languages, turn it into clear English, and retain the input even when an automated provider is unavailable. The user requires no paid models or hosting.

## Evidence

| Option | Coverage and capability | No-cost status | Production fit |
|---|---|---|---|
| Google Cloud Translation NMT | Automatic source detection and broad production translation coverage. | The first 500,000 characters each month are credited, but the API is billed beyond that and requires a Cloud billing project. | Strong quality but rejected because a hard no-cost guarantee is not possible. [1] |
| Cloudflare Workers AI with Meta M2M100 | Dedicated many-to-many translation model with 100-language coverage and 9,900 directions. | The Free Workers plan includes 10,000 AI neurons each day; the model consumes 31,050 neurons per million input tokens and the same per million output tokens. It fails when the free allocation is exceeded and requires no paid plan while below it. | Recommended translation engine for this low-volume personal app. A Worker keeps credentials out of the browser. [2] [3] [4] |
| Cloudflare IndicTrans2 | Dedicated translation for all 22 scheduled Indic languages. | Uses the same free Workers AI allocation model. | Valuable optional specialised route for Hindi and other Indian languages, but not a universal replacement. [3] [5] |
| MyMemory | Translation-memory search and machine translation for a declared language pair. | Free anonymous requests are limited to 5,000 characters per day, or 50,000 with a contact email. | Suitable only as a low-stakes tertiary fallback. It requires a language pair and its public community data is not the quality baseline. [6] [7] |
| Hosted LibreTranslate | Supports automatic source detection. | The official hosted instance requires a purchased API key. Self-hosting avoids the key but needs a server and model resources. | Rejected for the current no-paid-hosting, low-maintenance constraints. [8] [9] |
| Existing OpenRouter free models | Can generate a concise meaning and example after translation context. | Free-only policy preserved, but capacity and daily limits are provider-controlled. | Keep as enrichment fallback, not the first multilingual translation dependency. |

## Recommended direction

Add a free Cloudflare Worker endpoint called **Translate first**. It sends arbitrary text to M2M100, targets English, returns the detected or user-selected source language plus the English translation, and never exposes a Cloudflare credential to the browser. Smart capture then uses the translated English as grounding for the existing concise-entry generator.

The app should not claim universal automatic language recognition. M2M100 needs a source language parameter. The interface should offer **Auto / language selector**. Auto can be a lightweight script detector for reliable scripts such as Devanagari, Han, Arabic, Cyrillic, Hangul, and Thai. For short Latin-script words such as `bonjour`, the user should be able to select French when detection is uncertain. A first-class manual draft remains the permanent last fallback.

The service stays free for the owner’s expected small volume, but the copy must be transparent: Cloudflare resets its allocation daily and will refuse further requests after it is consumed. When that happens, Vocab Sync must preserve the submitted input as an editable draft and should not silently fall back to a paid service.

## Practical free-allocation estimate

At the documented M2M100 rate, a short vocabulary translation using approximately 12 input and 16 output tokens consumes about 0.8694 neurons. The 10,000-neuron daily free allocation is therefore approximately 11,502 requests at that size. Even a 200-token round trip is approximately 6.21 neurons, or about 1,610 requests per day. These are directional capacity calculations rather than service guarantees; Cloudflare can change model behavior or enforce additional limits.

The existing `vocab-sync-drive-auth` Worker already provides an authenticated, exact-origin backend and D1 binding. It currently has no Workers AI binding. The approved implementation would add that binding, a small authenticated `/translate` endpoint, request-size limits, and a fail-closed no-paid fallback policy.

## Proposed language-aware capture pipeline

| Stage | Behavior | Why it exists |
|---|---|---|
| Input classification | Keep the existing clean English dictionary path for a simple English word. Route phrases and non-English input to translation. | Avoids waiting for an AI model when a fast dictionary answer already exists. |
| Source language control | Provide `Auto` plus a language selector. Auto maps unambiguous scripts to a language family and shows a confidence hint. The selector is the reliable override for short Latin-script words, which cannot be detected honestly with high confidence from a single token. | A translation model needs a source language, and one word such as `merci` does not contain enough signal for dependable automatic identification. |
| Dedicated translation | The protected Worker calls M2M100 with a target of English. It returns the English translation and the source language used. | This is a translation model, not a general chat model, so it should be more predictable for phrases. |
| Vocabulary enrichment | Feed the original input, source language, and English translation to the current free-only generator when a key and free capacity exist. | Produces the existing concise meaning and natural example format. |
| No-AI fallback | If enrichment is unavailable, create an editable draft with the original text, English translation as the meaning, and a clear translation-based example sentence. | The capture never disappears and still provides useful value without OpenRouter. |
| Trust label | Mark each draft as `Dictionary`, `Translated`, `AI enriched`, or `Needs review`. | The user can see exactly what produced the text instead of trusting mystery soup. |

The recommended design uses no Google Translate scraping, no hidden paid-model fallback, and no browser-stored Cloudflare credential. It does require turning on the free Workers AI binding for the existing Worker and accepting Cloudflare's daily free allocation as a real, visible limit.

## References

[1] [Google Cloud Translation pricing](https://cloud.google.com/products/translate/pricing)

[2] [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

[3] [Cloudflare M2M100 model documentation](https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/)

[4] [M2M100 model card and language coverage](https://huggingface.co/facebook/m2m100_1.2B)

[5] [Cloudflare IndicTrans2 model documentation](https://developers.cloudflare.com/workers-ai/models/indictrans2-en-indic-1B/)

[6] [MyMemory API technical specifications](https://mymemory.translated.net/doc/spec.php)

[7] [MyMemory API usage limits](https://mymemory.translated.net/doc/usagelimits.php)

[8] [LibreTranslate API usage](https://docs.libretranslate.com/guides/api_usage/)

[9] [LibreTranslate API-key management](https://docs.libretranslate.com/guides/manage_api_keys/)
