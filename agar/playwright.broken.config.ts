import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// agar AC3 desync-broken fixture — issue #276.
//
// This is the RED-polarity sibling of agar/playwright.config.ts. It
// reuses the SAME `testDir: "e2e"` so the SAME byte-identical spec
// (`multiplayer-convergence.spec.ts`) runs — that invariance is what
// makes the polarity test honest. The only delta is the wrangler
// webServer command: `dev:agar-server:broken` boots the Worker with
// `AGAR_DO_BREAK_MODE=drop-every-7th`, which the DO reads once at
// construction and uses to silently elide every 7th input from the
// reducer fold while still broadcasting `dir` to clients.
//
// Under this config the ordering invariant
// (`pureReplay(SEED, appliedLog) === canonical`) on the
// continuously-connected page MUST FAIL. CI asserts non-zero exit;
// removing the drop logic causes this run to pass, which flips the
// red job green and fails CI. That two-sided gate is AC3.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries under the broken polarity — we want exactly one
  // shot at the assertion, and a retry-as-pass would silently soften
  // the red signal.
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
      // Worker with the AC3 break-mode env var set. Everything else
      // (port, probe URL, env hygiene) is identical so any divergence
      // between green and red is forced through the reducer drop.
      command: "npm run dev:agar-server:broken",
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
