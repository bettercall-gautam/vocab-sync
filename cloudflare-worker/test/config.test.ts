import { describe, expect, it } from "vitest";
import { getRuntimeConfig, type Env } from "../src/config";

const createEnv = (overrides: Partial<Env> = {}): Env => ({
  DB: {} as D1Database,
  FRONTEND_ORIGIN: "https://bettercall-gautam.github.io",
  FRONTEND_RETURN_URL: "https://bettercall-gautam.github.io/vocab-sync/",
  WORKER_ORIGIN: "https://vocab-sync-drive-auth.example.workers.dev",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  TOKEN_ENCRYPTION_KEY: "token-encryption-key",
  OWNER_GOOGLE_EMAIL: "owner@example.com",
  ...overrides,
});

describe("Worker runtime configuration", () => {
  it("normalizes safe HTTPS origins", () => {
    expect(getRuntimeConfig(createEnv())).toMatchObject({
      frontendOrigin: "https://bettercall-gautam.github.io",
      workerOrigin: "https://vocab-sync-drive-auth.example.workers.dev",
      ownerGoogleEmail: "owner@example.com",
    });
  });

  it("rejects a frontend callback on another origin", () => {
    expect(() => getRuntimeConfig(createEnv({ FRONTEND_RETURN_URL: "https://example.com/" }))).toThrow(
      "FRONTEND_RETURN_URL must belong to FRONTEND_ORIGIN.",
    );
  });

  it("rejects a non-HTTPS worker URL", () => {
    expect(() => getRuntimeConfig(createEnv({ WORKER_ORIGIN: "http://worker.example" }))).toThrow(
      "WORKER_ORIGIN must use HTTPS.",
    );
  });
});
