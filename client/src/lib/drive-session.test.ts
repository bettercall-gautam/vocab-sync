import { describe, expect, it } from "vitest";
import {
  getDriveSessionErrorMessage,
  getDriveWorkerOrigin,
  isDriveReauthorizationError,
  parseDriveSessionFromHash,
} from "./drive-session";

describe("persistent Drive session helpers", () => {
  it("accepts only a secure Worker origin without a path", () => {
    expect(getDriveWorkerOrigin("https://vocab-sync-drive-auth.example.workers.dev")).toBe(
      "https://vocab-sync-drive-auth.example.workers.dev",
    );
    expect(getDriveWorkerOrigin("http://worker.example")).toBeNull();
    expect(getDriveWorkerOrigin("https://worker.example/not-an-origin")).toBeNull();
  });

  it("extracts only a plausible opaque device session from the OAuth return fragment", () => {
    const session = "a".repeat(43);
    expect(parseDriveSessionFromHash(`#drive_session=${session}`)).toBe(session);
    expect(parseDriveSessionFromHash("#other=value")).toBeNull();
    expect(parseDriveSessionFromHash("#drive_session=too-short")).toBeNull();
  });

  it("maps revoked or absent device state to the one-time reconnect path", () => {
    expect(isDriveReauthorizationError("device_session_required")).toBe(true);
    expect(isDriveReauthorizationError("token_refresh_failed")).toBe(false);
    expect(getDriveSessionErrorMessage("drive_reauthorization_required")).toBe(
      "Drive needs one secure reconnect on this device.",
    );
  });
});
