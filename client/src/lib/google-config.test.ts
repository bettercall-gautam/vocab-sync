import { describe, expect, it } from "vitest";

describe("Google browser configuration", () => {
  it("accepts a well-formed public OAuth client ID at Google's authorization endpoint", async () => {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;

    expect(clientId).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);

    const response = await fetch(
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId ?? "")}&redirect_uri=https%3A%2F%2Fexample.invalid&response_type=code&scope=openid`,
      { redirect: "manual" },
    );
    const body = await response.text();
    expect(body).not.toContain("The OAuth client was not found");
    expect(body).not.toContain("invalid_client");
    expect([200, 302, 400]).toContain(response.status);
  }, 15_000);
});
