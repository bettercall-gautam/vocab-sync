import { base64ToBytes, base64UrlToBytes, bytesToBase64, bytesToBase64Url } from "./base64";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedValue = {
  ciphertext: string;
  iv: string;
};

export const importEncryptionKey = async (base64Key: string): Promise<CryptoKey> => {
  const rawKey = base64Key.includes("-") || base64Key.includes("_")
    ? base64UrlToBytes(base64Key)
    : base64ToBytes(base64Key);

  if (rawKey.byteLength !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must contain exactly 32 bytes.");
  }

  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

export const encryptText = async (
  plaintext: string,
  key: CryptoKey,
  additionalData: string,
): Promise<EncryptedValue> => {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(additionalData) },
    key,
    encoder.encode(plaintext),
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
};

export const decryptText = async (
  encrypted: EncryptedValue,
  key: CryptoKey,
  additionalData: string,
): Promise<string> => {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(encrypted.iv),
      additionalData: encoder.encode(additionalData),
    },
    key,
    base64ToBytes(encrypted.ciphertext),
  );

  return decoder.decode(plaintext);
};

export const sha256Base64Url = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
};
