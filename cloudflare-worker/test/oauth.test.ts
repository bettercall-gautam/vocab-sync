import { describe, expect, it } from "vitest";
import { buildGoogleAuthorizationUrl } from "../src/oauth";

describe("Google OAuth authorization URL", () => {
  it("requests the configured client, offline Drive access, and the exact Worker callback", () => {
    const url = new URL(
      buildGoogleAuthorizationUrl(
        "google-client-id",
        {
          frontendOrigin: "https://bettercall-gautam.github.io",
          frontendReturnUrl: "https://bettercall-gautam.github.io/vocab-sync/",
          workerOrigin: "https://vocab-sync-drive-auth.example.workers.dev",
          ownerGoogleEmail: "owner@example.com",
        },
        "csrf-state",
      ),
    );

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://vocab-sync-drive-auth.example.workers.dev/auth/google/callback",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/drive.file");
  });
});
