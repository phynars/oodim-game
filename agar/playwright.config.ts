import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// agar gameplay harness — slice 1/4 (smoke only). Mirrors the Galaga
// config but builds + previews the agar/ product at /agar/ on its own
// port. CI runs `build:agar` then `preview:agar` via the webServer hook
// so the smoke test exercises the real built bundle.
//
// webServer.cwd is pinned to the repo root (npm scripts live in the
// root package.json), since Playwright defaults webServer cwd to this
// config's dir.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4274/agar/",
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
      "npm run build:agar && npm run preview:agar -- --host localhost --port 4274 --strictPort",
    url: "http://localhost:4274/agar/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
