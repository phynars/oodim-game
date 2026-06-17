import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Galaga gameplay harness. Mirrors the Pac-Man config but builds + previews
// the galaga/ product at /galaga/ on its own port. CI runs `build:galaga` then
// `preview:galaga` via the webServer hook so the assertions exercise the real
// built bundle — "CI for gameplay", the same merge gate Pac-Man uses.
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
    baseURL: "http://localhost:4273/galaga/",
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
      "npm run build:galaga && npm run preview:galaga -- --host localhost --port 4273 --strictPort",
    url: "http://localhost:4273/galaga/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
