import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// agar persistence-harness — RED-polarity sibling for slice 1
// (`monotonic-persist`). Mirror of `agar/playwright.broken.config.ts`
// (the #276 multiplayer red-polarity config), adapted to the
// persistence rung per #323.
//
// Reuses the SAME `testDir: "e2e"` so the SAME byte-identical
// `persistence-harness.spec.ts` runs under this config — that
// invariance is what makes the polarity test honest. The ONLY delta
// is the wrangler webServer command:
// `dev:agar-server:broken-non-monotone-persist` boots the Worker with
// `AGAR_DO_BREAK_MODE=non-monotone-persist`, which the DO reads once at
// construction and uses to violate the monotonic-persist contract
// (writing back to storage out of order, or rewinding the persisted
// frontier — slice 1 owns the exact mechanic).
//
// Under this config the `monotonic-persist` test MUST FAIL once #319
// unskips it. The workflow's red-polarity job runs this config via
// `npm run test:e2e:agar:persistence:broken-non-monotone` and inverts
// the exit code: a pass here means the guard is dishonest (CI fail);
// a fail here means the guard caught the broken break-mode (CI pass).
// Until #319 lands, the workflow's skip-when-skipped preflight
// short-circuits this run entirely.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries under the broken polarity — we want exactly one shot at
  // the assertion. A retry-as-pass would silently soften the red
  // signal. Matches `playwright.broken.config.ts`.
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
      // per the workflow's WIRING note — do not regress).
      command: "npm run dev:agar-server:broken-non-monotone-persist",
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
