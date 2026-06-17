import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Pac-Man gameplay harness. Builds + previews the pacman/ product at /pacman/
// on its own port via the webServer hook so the assertions exercise the real
// built bundle — "CI for gameplay" (mirrors galaga/playwright.config.ts).
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
    baseURL: "http://localhost:4173/pacman/",
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
      "npm run build:pacman && npm run preview:pacman -- --host localhost --port 4173 --strictPort",
    url: "http://localhost:4173/pacman/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
