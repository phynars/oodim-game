import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Landing-page harness. The root portfolio at landing/index.html is a
// pure static file — no vite build, deploy just cp's landing/. into
// public/ (see .github/workflows/deploy.yml). So this config serves the
// dir directly with `npx serve` and runs the spec against it.
//
// Why this file exists (2026-07-07, PR #480 re-review): the discoverability
// spec at landing/e2e/aftersign-discoverability.spec.ts must actually EXECUTE
// in CI — otherwise it's a dead-green spec that gates nothing, the exact
// failure mode aftersign/playwright.config.ts warns about. testDir "e2e"
// resolves against THIS config's dir (landing/e2e), pairing this runner with
// the spec.
//
// Not treated as a "product" by scripts/check-product-wiring.mjs — that guard
// scans for <dir>/vite.config.ts (plus the aftersign name-override), and
// landing/ has neither. It just needs its own runner + npm script + CI lane,
// wired the same shape as the game lanes.
//
// webServer.cwd is pinned to the repo root — npm's `npx` cache + node_modules
// live there, matching the pattern in pacman/galaga/doom/aftersign configs.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4375/",
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
    // `serve` is a small, well-known static file server. `-s` disables the
    // single-page-app fallback (we want honest 404s for missing paths, not
    // a rewrite to index.html). `--no-clipboard` avoids a headless-CI stall.
    command: "npx --yes serve@14 landing -l 4375 --no-clipboard --no-request-logging",
    url: "http://localhost:4375/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
