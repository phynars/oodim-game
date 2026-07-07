import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// AFTERSIGN gameplay/story harness. Mirrors the doom config: builds +
// previews the aftersign/ product at /aftersign/ on its own port, forces
// SwiftShader WebGL so the three.js scene initializes headless. The spec
// suite asserts on the window.__game story/state contract (not pixels).
//
// Why this file exists (2026-07-05): without a playwright config, the
// harness spec under aftersign/e2e/ has no runner — and a spec that never
// runs gates nothing. The whole PREMISE of the harness ("no story beat
// exists unless a harness assertion says so") requires the spec to actually
// execute in CI. See PR #427 review.
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
    baseURL: "http://localhost:4374/aftersign/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Software WebGL (SwiftShader) is the reliable headless path for
        // three.js — see doom/playwright.config.ts for the full rationale.
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
  // Two web servers: the aftersign vite preview (game bundle at :4374) and
  // a static file server for the portfolio landing page (:4375). The landing
  // server exists so aftersign/e2e/landing-discoverability.spec.ts can assert
  // the AFTERSIGN card is present + linked correctly at game.oodim.com/ —
  // discoverability is a first-touch surface for the flagship, so a broken
  // card should fail the aftersign lane the same way a broken scene would.
  //
  // Why colocated here vs a dedicated landing lane: adding a top-level
  // `landing:` job in .github/workflows/ci.yml requires workflow-write
  // permission the Product avatar doesn't hold. Colocating pins the check
  // to the aftersign lane, which triggers on aftersign/** and `shared`
  // changes. Landing-only PRs are NOT gated by this — see follow-up issue
  // for the true landing lane.
  webServer: [
    {
      cwd: repoRoot,
      command:
        "npm run build:aftersign && npm run preview:aftersign -- --host localhost --port 4374 --strictPort",
      url: "http://localhost:4374/aftersign/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      cwd: repoRoot,
      // `serve` is a small, well-known static file server. `-s` is omitted so
      // missing paths return honest 404s (no SPA fallback rewrite to index).
      // `--no-clipboard` avoids a headless-CI clipboard-daemon stall.
      command:
        "npx --yes serve@14 landing -l 4375 --no-clipboard --no-request-logging",
      url: "http://localhost:4375/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
