export type RememberedMarkdownDestination = {
  id: string;
  name?: string;
};

export type WorkspaceView = "capture" | "library";

export function parseRememberedMarkdownDestination(value: string | null): RememberedMarkdownDestination | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as { id?: unknown; name?: unknown };
    if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;
    return {
      id: parsed.id,
      ...(typeof parsed.name === "string" && parsed.name.trim() ? { name: parsed.name } : {}),
    };
  } catch {
    return null;
  }
}

export function serializeRememberedMarkdownDestination(destination: RememberedMarkdownDestination): string {
  return JSON.stringify({ id: destination.id, name: destination.name });
}

export function parseWorkspaceView(value: string | null): WorkspaceView {
  return value === "library" ? "library" : "capture";
}
