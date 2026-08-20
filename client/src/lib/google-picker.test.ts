import { describe, expect, it } from "vitest";
import { getDriveAppId, hasPickerBootstrapPrerequisites } from "./google-picker";

describe("hasPickerBootstrapPrerequisites", () => {
  it("accepts configured browser values before the picker module itself loads", () => {
    expect(hasPickerBootstrapPrerequisites({
      apiKey: "AIza-browser-key",
      folderId: "the-shelf-folder",
      hasGapi: true,
    })).toBe(true);
  });

  it("rejects a missing browser API key", () => {
    expect(hasPickerBootstrapPrerequisites({ folderId: "the-shelf-folder", hasGapi: true })).toBe(false);
  });

  it("rejects a missing folder ID or Google API loader", () => {
    expect(hasPickerBootstrapPrerequisites({ apiKey: "AIza-browser-key", hasGapi: true })).toBe(false);
    expect(hasPickerBootstrapPrerequisites({ apiKey: "AIza-browser-key", folderId: "the-shelf-folder", hasGapi: false })).toBe(false);
  });
});

describe("getDriveAppId", () => {
  it("extracts the Cloud project number from a web OAuth client ID", () => {
    expect(getDriveAppId("357962225405-example.apps.googleusercontent.com")).toBe("357962225405");
  });

  it("rejects an invalid or unavailable OAuth client ID", () => {
    expect(getDriveAppId("not-a-google-client-id")).toBeUndefined();
    expect(getDriveAppId()).toBeUndefined();
  });
});
