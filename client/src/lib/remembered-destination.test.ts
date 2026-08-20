import { describe, expect, it } from "vitest";
import {
  parseRememberedMarkdownDestination,
  parseWorkspaceView,
  serializeRememberedMarkdownDestination,
} from "./remembered-destination";

describe("remembered Markdown destination", () => {
  it("restores a valid selected file identifier and name", () => {
    expect(parseRememberedMarkdownDestination('{"id":"file-123","name":"vocab.md"}')).toEqual({
      id: "file-123",
      name: "vocab.md",
    });
  });

  it("rejects malformed or incomplete saved data", () => {
    expect(parseRememberedMarkdownDestination("not-json")).toBeNull();
    expect(parseRememberedMarkdownDestination('{"name":"vocab.md"}')).toBeNull();
    expect(parseRememberedMarkdownDestination('{"id":""}')).toBeNull();
  });

  it("serializes only the destination metadata needed for a later Drive reload", () => {
    const saved = serializeRememberedMarkdownDestination({ id: "file-123", name: "vocab.md" });
    expect(JSON.parse(saved)).toEqual({ id: "file-123", name: "vocab.md" });
  });

  it("restores the last known workspace view safely", () => {
    expect(parseWorkspaceView("library")).toBe("library");
    expect(parseWorkspaceView("capture")).toBe("capture");
    expect(parseWorkspaceView("unexpected")).toBe("capture");
    expect(parseWorkspaceView(null)).toBe("capture");
  });
});
