import { readFile, writeFile } from "node:fs/promises";

const bundlePath = "/tmp/vocab-sync-drive-auth-review-sync.mjs";
const outputPath = "/tmp/vocab-sync-drive-auth-review-sync-deploy.json";
const encodedBundle = (await readFile(bundlePath)).toString("base64");

const code = `async () => {
  const source = new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(encodedBundle)}), character => character.charCodeAt(0)));
  const metadata = {
    main_module: "worker.mjs",
    compatibility_date: "2026-08-20",
    bindings: ["DB", "FRONTEND_ORIGIN", "FRONTEND_RETURN_URL", "WORKER_ORIGIN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY", "OWNER_GOOGLE_EMAIL"].map(name => ({ type: "inherit", name })),
  };
  const boundary = "----VocabSyncReviewSync";
  const body = [
    \`--\${boundary}\`,
    'Content-Disposition: form-data; name="metadata"',
    "Content-Type: application/json",
    "",
    JSON.stringify(metadata),
    \`--\${boundary}\`,
    'Content-Disposition: form-data; name="worker.mjs"; filename="worker.mjs"',
    "Content-Type: application/javascript+module",
    "",
    source,
    \`--\${boundary}--\`,
    "",
  ].join("\\r\\n");
  return cloudflare.request({
    method: "PUT",
    path: \`/accounts/\${accountId}/workers/scripts/vocab-sync-drive-auth\`,
    query: { bindings_inherit: "strict" },
    body,
    contentType: \`multipart/form-data; boundary=\${boundary}\`,
    rawBody: true,
  });
}`;

await writeFile(outputPath, JSON.stringify({ code }));
