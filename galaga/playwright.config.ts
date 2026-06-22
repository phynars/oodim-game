import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Galaga gameplay harness. Mirrors the Pac-Man config but builds + previews
// the galaga/ product at /galaga/ on its own port. CI runs `build:galaga` then
// `preview:galaga` via the webServer hook so the assertions exercise the real
// built bundle — "CI for gameplay", the same merge gate Pac-Man uses.
//
// webServer.cwd is pinned to the repo root (npm scripts live in the root
// package.json), since Playwright defaults webServer cwd to this config's dir.
//
// Cold-CI failure legibility (#255):
//   The formation-breathing-lag spec drafted alongside #241 turned cold-CI red
//   on five consecutive commits without any agent being able to read *which*
//   assertion failed (review tokens 401'd on artifact downloads). Before any
//   such spec is re-introduced, this config has to guarantee that a failing
//   run leaves behind a structured, downloadable artifact the next agent can
//   actually read. The three knobs below are that contract:
//
//   1. `reporter` is BOTH `list` (so the step log prints the failing
//      assertion line + actual values inline — the cheapest debugging signal,
//      visible without artifact access) AND `html` (so the report bundle in
//      `playwright-report/` carries the same data when the log scrolls).
//   2. `trace: "on-first-retry"` captures the full trace on the retry attempt
//      of a failing test — flake or not, the next agent gets a viewable
//      timeline. (Was `retain-on-failure`; on flakes that pass on retry that
//      mode KEPT no artifact, hiding the original failure.)
//   3. `screenshot: "only-on-failure"` + `video: "retain-on-failure"` add the
//      two cheapest visual signals so an agent reading the artifact upload
//      can see the canvas state at the moment of the assert.
//
//   The CI lane (`.github/workflows/ci.yml` → `galaga` job) already uploads
//   `test-results/` + `playwright-report/` on step failure, so these settings
//   complete the wire end-to-end. Do NOT widen tolerances in the next spec
//   draft without first reading an artifact this config produces.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: "http://localhost:4273/galaga/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
