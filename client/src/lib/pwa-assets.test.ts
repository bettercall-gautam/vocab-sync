import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicDirectory = resolve(process.cwd(), "client/public");

describe("PWA home-screen assets", () => {
  it("defines an app-style Vocab Sync manifest with a branded icon", () => {
    const manifest = JSON.parse(readFileSync(resolve(publicDirectory, "manifest.webmanifest"), "utf8")) as {
      name: string;
      short_name: string;
      display: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };

    expect(manifest).toMatchObject({
      name: "Vocab Sync",
      short_name: "Vocab Sync",
      display: "standalone",
      theme_color: "#183e66",
    });
    expect(manifest.icons).toContainEqual(expect.objectContaining({
      src: "vocab-sync-icon-192.png",
      sizes: "192x192",
    }));
    expect(manifest.icons).toContainEqual(expect.objectContaining({
      src: "vocab-sync-icon-512.png",
      sizes: "512x512",
      purpose: "any maskable",
    }));
    expect(readFileSync(resolve(publicDirectory, "vocab-sync-icon.svg"), "utf8")).toContain("<svg");
    expect(readFileSync(resolve(publicDirectory, "vocab-sync-icon-192.png")).byteLength).toBeGreaterThan(0);
    expect(readFileSync(resolve(publicDirectory, "vocab-sync-icon-512.png")).byteLength).toBeGreaterThan(0);
  });

  it("uses a non-caching service worker so new GitHub Pages releases stay fresh", () => {
    const serviceWorker = readFileSync(resolve(publicDirectory, "sw.js"), "utf8");

    expect(serviceWorker).toContain("self.skipWaiting()");
    expect(serviceWorker).toContain("self.clients.claim()");
    expect(serviceWorker).not.toContain('addEventListener("fetch"');
  });
});
