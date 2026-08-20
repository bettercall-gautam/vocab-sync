const base64UrlPadding = (value: string): string => {
  const padding = (4 - (value.length % 4)) % 4;
  return `${value}${"=".repeat(padding)}`;
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const bytesToBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

export const base64UrlToBytes = (value: string): Uint8Array =>
  base64ToBytes(base64UrlPadding(value.replaceAll("-", "+").replaceAll("_", "/")));

export const randomBase64Url = (length = 32): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
};
