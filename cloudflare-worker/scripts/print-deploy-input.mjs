import { readFile } from "node:fs/promises";

const [bundlePath] = process.argv.slice(2).filter((argument) => argument !== "--");
if (!bundlePath) {
  throw new Error("Pass the bundled Worker module path as the first argument.");
}

const workerModule = await readFile(bundlePath, "utf8");
const scriptName = "vocab-sync-drive-auth";
const databaseId = "f89200ed-67c7-4e3d-af2e-0cd4fd9556bb";
const boundary = `----vocab-sync-${crypto.randomUUID()}`;

const metadata = {
  main_module: "worker.mjs",
  compatibility_date: "2026-08-20",
  bindings: [
    { type: "d1", name: "DB", id: databaseId },
    { type: "plain_text", name: "FRONTEND_ORIGIN", text: "https://bettercall-gautam.github.io" },
    { type: "plain_text", name: "FRONTEND_RETURN_URL", text: "https://bettercall-gautam.github.io/vocab-sync/" },
    {
      type: "plain_text",
      name: "WORKER_ORIGIN",
      text: "https://vocab-sync-drive-auth.gautamjaizz007.workers.dev",
    },
  ],
};

const multipartBody = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="metadata"',
  "Content-Type: application/json",
  "",
  JSON.stringify(metadata),
  `--${boundary}`,
  'Content-Disposition: form-data; name="worker.mjs"; filename="worker.mjs"',
  "Content-Type: application/javascript+module",
  "",
  workerModule,
  `--${boundary}--`,
  "",
].join("\r\n");

const code = `async () => {
  const body = ${JSON.stringify(multipartBody)};
  return cloudflare.request({
    method: "PUT",
    path: \`/accounts/\${accountId}/workers/scripts/${scriptName}\`,
    body,
    contentType: "multipart/form-data; boundary=${boundary}",
    rawBody: true,
  });
}`;

process.stdout.write(JSON.stringify({ code }));
