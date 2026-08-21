# Free-model reliability research

This record captures the live OpenRouter catalog and documentation reviewed on August 20, 2026 before changing Vocab Sync’s free-model fallback strategy.

## Live catalog findings

OpenRouter’s public model catalog reported **416** models. It listed **20** models with zero prompt and completion prices, of which **11** advertised `response_format` or `structured_outputs` support. The live catalog did **not** contain an Owl Alpha match, so `openrouter/owl-alpha` cannot be added as an available current fallback from this evidence.

The existing app chain contains four entries: `openrouter/free`, `nvidia/nemotron-3.5-lightning:free`, `z-ai/glm-5.2:free`, and `google/gemma-4-31b-it:free`. The current catalog shows that Nemotron 3.5 Lightning and Gemma 4 31B do not advertise structured outputs, although they advertise general response-format support. The app currently passes `response_format: { type: "json_object" }` and suppresses every provider error, so it cannot distinguish a capacity error from an unsupported-parameter, malformed-output, or incomplete-output failure.

| Candidate | Live free status | Structured-output support | Expiration shown |
|---|---:|---:|---|
| `z-ai/glm-5.2:free` | Yes | Yes | None |
| `openai/gpt-oss-20b:free` | Yes | Yes | None |
| `nvidia/nemotron-3-super-120b-a12b:free` | Yes | Yes | None |
| `google/gemma-4-26b-a4b-it:free` | Yes | Yes | None |
| `liquid/lfm-2.5-2.6b:free` | Yes | Yes | None |
| `dots-studio/dots-3-note-preview:free` | Yes | Yes | 2026-09-30 |
| `nvidia/nemotron-nano-9b-v2:free` | Yes | Yes | 2026-08-24 |

## Official routing findings

OpenRouter’s provider-routing documentation says requests load-balance across providers by default, allows `provider.require_parameters: true` to restrict routing to endpoints that support all request parameters, and supports ordering providers by throughput or latency. Its structured-output documentation says support is endpoint specific and recommends `response_format.type: "json_schema"` plus `provider.require_parameters: true` when structured output is required.

The implementation should therefore use explicit currently live free models with structured-output support, request a strict JSON schema, require compatible provider endpoints, apply a short retry only for transient errors, and preserve diagnostic status codes without exposing API keys.

## August 21 reassessment for short vocabulary notes

The live zero-cost structured-output catalog now returns six candidates when sorted by OpenRouter latency: `nvidia/nemotron-nano-9b-v2:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `dots-studio/dots-3-note-preview:free`, `liquid/lfm-2.5-2.6b:free`, `openai/gpt-oss-20b:free`, and `z-ai/glm-5.2:free`. The Nano model is the lowest-latency catalog result but expires on 2026-08-24, so it cannot be the app’s sole durable model. The Dots preview also expires on 2026-09-30. The current recent production failures confirm that advertised structured-output support is not enough by itself for the prior five-model strategy.

For Vocab Sync, the success criteria are short time to first output, simple definitions and examples, reliable valid JSON, no paid fallback, and a stable model identifier. The small one-word task does not benefit from mandatory reasoning. The live catalog marks LFM 2.5 2.6B and GPT OSS 20B as mandatory-reasoning models, while GLM 5.2 defaults to high reasoning effort. They are poor primary choices when user-visible speed is more valuable than broad-agent quality.

OpenRouter documents a free Response Healing plugin for non-streaming structured-output calls. It repairs JSON syntax and markdown-wrapped JSON before the client receives it, while OpenRouter’s benchmark article reports negligible typical added latency. It cannot repair missing semantic fields or truly empty output. This points to a simpler durable primary model, a single fallback only when the primary has an actual transport or empty-output failure, and Response Healing rather than repeated multi-group roulette for syntax defects.

### Selected strategy

The selected production strategy uses `openai/gpt-oss-20b:free` as the primary and `nvidia/nemotron-3-super-120b-a12b:free` as its sole durable fallback. Both are currently zero-cost and advertise structured-output support. The temporary lowest-latency Nano candidate is intentionally excluded because its current catalog expiration is 2026-08-24; the Dots candidate is likewise a preview expiring on 2026-09-30. The request preserves model priority, asks each eligible model for low-effort reasoning only, limits completion tokens for the tiny task, uses free Response Healing, and clamps rare overlong text locally instead of spending another full generation request. This is a deliberate speed and consistency tradeoff: it is not a guarantee against the availability limits inherent to free endpoints.

### Latency follow-up

The live latency-sorted zero-cost structured-output catalog ranks durable `nvidia/nemotron-3-super-120b-a12b:free` ahead of `openai/gpt-oss-20b:free`. The current priority order therefore optimizes documented JSON quality before speed. The owner’s eight successful responses out of nine confirm the strategy is broadly functional, but the reported latency makes that tradeoff wrong for this one-word tool. The next measured change should reverse only these two stable models, retaining the same schema, free Response Healing, local concision, and free-only safety guard. The attached five-model error is from an earlier build and cannot be attributed to the verified two-model asset.

### Free-tier cap follow-up

OpenRouter’s limits documentation confirms an account-wide cap of 50 free-model requests per day and 20 free-model requests per minute for accounts that have purchased less than 10 credits. The owner’s latest `429 free-models-per-day` screenshot is therefore an OpenRouter account-limit event, not a model or Vocab Sync defect. Additional API keys or accounts do not alter those globally governed limits. The app cannot make a successful free request faster after the provider has rejected it, but it can recognize this specific account-level limit immediately and stop futile retries across the second model. The planned no-cost refinement is a direct, clear daily-cap message that recommends waiting for the provider reset or using the existing manual-entry path, not a paid fallback or quota-bypass attempt.

## Sources

[1] [OpenRouter live model catalog](https://openrouter.ai/api/v1/models)

[2] [OpenRouter structured outputs guide](https://openrouter.ai/docs/guides/features/structured-outputs)

[3] [OpenRouter provider routing guide](https://openrouter.ai/docs/guides/routing/provider-selection)

[4] [OpenRouter Models API guide](https://openrouter.ai/docs/guides/overview/models)

[5] [OpenRouter Response Healing guide](https://openrouter.ai/docs/guides/features/plugins/response-healing)

[6] [OpenRouter Response Healing announcement](https://openrouter.ai/blog/announcements/response-healing-reduce-json-defects-by-80percent/)

[7] [OpenRouter reasoning-token guide](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)

[8] [OpenRouter limits guide](https://openrouter.ai/docs/api_reference/limits)

[9] [OpenRouter free-model router guide](https://openrouter.ai/docs/guides/routing/routers/free-router)
