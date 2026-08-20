export const driveSessionStorageKey = "vocab-sync-drive-device-session";

const sessionPattern = /^[A-Za-z0-9_-]{32,128}$/;

export function getDriveWorkerOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || (url.pathname !== "/" && url.pathname !== "")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseDriveSessionFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("drive_session");
  return value && sessionPattern.test(value) ? value : null;
}

export function isDriveReauthorizationError(code: string | null): boolean {
  return code === "device_session_required" || code === "drive_connection_required" || code === "drive_reauthorization_required";
}

export function getDriveSessionErrorMessage(code: string | null): string {
  if (isDriveReauthorizationError(code)) {
    return "Drive needs one secure reconnect on this device.";
  }

  if (code === "origin_not_allowed") {
    return "This Vocab Sync site address is not allowed to restore Drive yet.";
  }

  return "Drive could not be restored. Your local drafts remain safe on this device.";
}
