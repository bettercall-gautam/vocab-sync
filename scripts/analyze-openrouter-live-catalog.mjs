import { mkdir, writeFile } from "node:fs/promises";

const response = await fetch(
  "https://openrouter.ai/api/v1/models?sort=latency-low-to-high&supported_parameters=structured_outputs",
);

if (!response.ok) throw new Error(`OpenRouter Models API failed with HTTP ${response.status}.`);

const payload = await response.json();
const models = (payload.data ?? [])
  .filter(model => model?.pricing?.prompt === "0" && model?.pricing?.completion === "0")
  .map(model => ({
    id: model.id,
    name: model.name,
    supportedParameters: model.supported_parameters,
    pricing: model.pricing,
    perRequestLimits: model.per_request_limits,
    contextLength: model.context_length,
    created: model.created,
    expirationDate: model.expiration_date,
    description: model.description,
  }));

await mkdir("docs", { recursive: true });
await writeFile(
  "docs/openrouter-live-free-structured-models.json",
  `${JSON.stringify({ retrievedAt: new Date().toISOString(), total: models.length, models }, null, 2)}\n`,
);

console.log(JSON.stringify({ total: models.length, models: models.slice(0, 15) }, null, 2));
