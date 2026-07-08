import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Landing-page discoverability lane.
//
// This config exists so a landing-only PR (one that only edits
// landing/**) still runs the AFTERSIGN discoverability spec — the
// aftersign lane's paths-filter doesn't include landing/**, so without a
// dedicated lane a broken portfolio card would ship green.
//
// The spec itself lives at aftersign/e2e/landing-discoverability.spec.ts
// (belt-and-suspenders: the aftersign lane also runs it via a second
// webServer). Pointing testDir at that path here avoids duplicating the
// spec and keeps a single source of truth for the assertions.
//
// The webServer is scripts/serve-landing.mjs — a tiny zero-dep static
// file server for landing/ on :4375, the same one the aftersign config
// boots. No vite build needed: landing/ is pure static HTML.
//
// webServer.cwd is pinned to the repo root (the serve script lives under
// scripts/ and reads landing/ relative to CWD).
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "../aftersign/e2e",
  testMatch: /landing-discoverability\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    // Absolute URLs are used in the spec, so baseURL is informational.
    baseURL: "http://localhost:4375/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      cwd: repoRoot,
      command: "node scripts/serve-landing.mjs 4375",
      url: "http://localhost:4375/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
