import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Agar gameplay harness — agar-00 scaffold gate. Builds + previews the agar/
// product at /agar/ on its own port via the webServer hook so assertions
// exercise the real built bundle (mirrors pacman/playwright.config.ts).
//
// host = localhost (NOT 127.0.0.1) — see #16's localhost-vs-127.0.0.1 lesson:
// the baseURL and the preview's bound host must match exactly, or webServer
// readiness checks pass while the test navigation 404s. Same hostname both
// places.
//
// webServer.cwd is pinned to the repo root (npm scripts live in the root
// package.json), since Playwright defaults webServer cwd to this config's dir.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4176/agar/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    cwd: repoRoot,
    command:
      "npm run build:agar && npm run preview:agar -- --host localhost --port 4176 --strictPort",
    url: "http://localhost:4176/agar/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
