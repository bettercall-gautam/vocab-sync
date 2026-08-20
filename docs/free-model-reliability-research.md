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

## Sources

[1] [OpenRouter live model catalog](https://openrouter.ai/api/v1/models)

[2] [OpenRouter structured outputs guide](https://openrouter.ai/docs/guides/features/structured-outputs)

[3] [OpenRouter provider routing guide](https://openrouter.ai/docs/guides/routing/provider-selection)
