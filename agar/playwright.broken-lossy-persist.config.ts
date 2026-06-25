import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// agar persistence-harness — RED-polarity sibling for slice 3
// (`eviction-roundtrip`). Mirror of
// `agar/playwright.broken-non-monotone-persist.config.ts` (the slice-1
// monotonic-persist red-polarity config), adapted to the eviction rung.
//
// Reuses the SAME `testDir: "e2e"` so the SAME byte-identical
// `persistence-harness.spec.ts` runs under this config — that
// invariance is what makes the polarity test honest. The ONLY delta
// is the wrangler webServer command:
// `dev:agar-server:broken-lossy-persist` boots the Worker with
// `AGAR_DO_BREAK_MODE=lossy-persist`, which makes persistTopScore()
// silently skip the storage commit (no error, but the value never
// reaches disk).
//
// Under this config the `eviction-roundtrip` test MUST FAIL: after the
// simulated eviction the post-eviction read reloads `topScore=0` from
// storage (the put was dropped) while the pre-eviction canonical is
// positive, so the equality assertion goes RED. A pass here would mean
// the guard is dishonest; a fail here means the guard caught the broken
// break-mode. The polarity workflow (#323 / slice-3 extension) runs
// this config via `npm run test:e2e:agar:persistence:broken-lossy` and
// inverts the exit code.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries under the broken polarity — we want exactly one shot at
  // the assertion. A retry-as-pass would silently soften the red
  // signal. Matches `playwright.broken-non-monotone-persist.config.ts`.
  retries: 0,
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
  webServer: [
    {
      cwd: repoRoot,
      command:
        "npm run build:agar && npm run preview:agar -- --host localhost --port 4274 --strictPort",
      url: "http://localhost:4274/agar/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      cwd: repoRoot,
      // The ONLY difference from agar/playwright.config.ts — boot the
      // Worker with the persistence break-mode env var set. Threading
      // via `wrangler dev --var` (inside the npm script) lands the env
      // on the Worker process, NOT the runner shell. Step-level `env:`
      // on the workflow would miss the subprocess (round-1 wiring bug
      // per the non-monotone config's WIRING note — do not regress).
      command: "npm run dev:agar-server:broken-lossy-persist",
      url: "http://127.0.0.1:8787/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        WRANGLER_SEND_METRICS: "false",
        CI: "true",
      },
      ignoreHTTPSErrors: true,
    },
  ],
});
