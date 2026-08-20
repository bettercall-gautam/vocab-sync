import { describe, expect, it } from "vitest";
import { bytesToBase64 } from "../src/base64";
import { decryptText, encryptText, importEncryptionKey, sha256Base64Url } from "../src/crypto";

const createKey = (): string => {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return bytesToBase64(key);
};

describe("Worker token encryption", () => {
  it("round-trips a refresh token using AES-GCM with bound additional data", async () => {
    const key = await importEncryptionKey(createKey());
    const encrypted = await encryptText("refresh-token-value", key, "vocab-sync:primary:refresh-token:v1");

    expect(encrypted.ciphertext).not.toContain("refresh-token-value");
    await expect(decryptText(encrypted, key, "vocab-sync:primary:refresh-token:v1")).resolves.toBe("refresh-token-value");
  });

  it("rejects decryption when the encryption context differs", async () => {
    const key = await importEncryptionKey(createKey());
    const encrypted = await encryptText("refresh-token-value", key, "expected-context");

    await expect(decryptText(encrypted, key, "wrong-context")).rejects.toThrow();
  });

  it("creates stable one-way SHA-256 session identifiers", async () => {
    const first = await sha256Base64Url("browser-session-token");
    const second = await sha256Base64Url("browser-session-token");
    const different = await sha256Base64Url("another-token");

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).not.toContain("browser-session-token");
  });
});
