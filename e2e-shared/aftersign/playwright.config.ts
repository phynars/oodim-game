import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// AFTERSIGN story-state harness (docs/flagship/story-state-contract.md).
//
// Serves aftersign/index.html through a plain `vite <root>` dev server (the
// page is a self-contained module page with CDN imports — no per-dir vite
// config exists yet, and none is needed to exercise the story surface).
//
// Mirrors doom/playwright.config.ts for the WebGL-in-headless-CI flags:
// aftersign renders with three.js/WebGL, which is OFF by default in headless
// Chromium, so we force the software (SwiftShader) path. Assertions read the
// `window.__game` story-state contract — never pixels.
//
// webServer.cwd is pinned to the repo root (the vite binary resolves from the
// root package.json), since Playwright defaults webServer cwd to this
// config's dir.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4179/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Software WebGL (SwiftShader) — same rationale as doom's config:
        // a real WebGL context with no GPU, reliable in headless CI.
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
  ],
  webServer: {
    cwd: repoRoot,
    command: "npx vite aftersign --host localhost --port 4179 --strictPort",
    url: "http://localhost:4179/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
