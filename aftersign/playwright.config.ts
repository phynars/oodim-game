import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
// A served run must not boot a local Vite preview: it would silently test the
// checkout rather than the page that was just deployed.
const servedBaseURL = process.env.AFTERSIGN_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  testIgnore: [
    "packet-intent-contract.spec.ts",
    "packet-intent-vertical-slice-contract.spec.ts",
    "io-recognition-cue-contract.spec.ts",
    "recognition-beat-contract.spec.ts",
    "npc-memory-dialogue-contract.spec.ts",
    "first-camera-move-feel-contract.spec.ts",
    "io-return-memory-beat-contract.spec.ts",
    "io-returning-recognition-line-contract.spec.ts",
    "memory-prompt-timing-feel-contract.spec.ts",
    "kiosk-scene-contract.spec.ts",
    "orra-recognition-memory-contract.spec.ts",
    "hard-navigation-save-survival-contract.spec.ts",
    "flagship-runnable-slice-spine-contract.spec.ts",
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  reporter: [["list"], ["json", { outputFile: "playwright-report/results.json" }]],
  use: {
    baseURL: servedBaseURL ?? "http://localhost:4374/aftersign/",
    // Served evidence is a release record, not only a failure diagnostic.
    trace: servedBaseURL ? "on" : "retain-on-failure",
    video: servedBaseURL ? "on" : "retain-on-failure",
  },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: {
        args: [
          "--use-gl=angle",
          "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader",
          "--ignore-gpu-blocklist",
        ],
      },
    },
  }],
  // `AFTERSIGN_BASE_URL` is the explicit served-mode switch used by deploy.
  // Omitting webServer is deliberate: a deployment verification must be unable
  // to fall back to a local build if the production URL is unavailable.
  webServer: servedBaseURL ? undefined : [
    {
      cwd: repoRoot,
      command: "npm run build:aftersign && npm run preview:aftersign -- --host localhost --port 4374 --strictPort",
      url: "http://localhost:4374/aftersign/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      cwd: repoRoot,
      command: "node scripts/serve-landing.mjs 4375",
      url: "http://localhost:4375/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
