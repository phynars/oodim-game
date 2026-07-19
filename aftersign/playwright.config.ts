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
  // AFTERSIGN gets two MORE retries than sibling three.js lanes (pacman /
  // galaga / doom / agar all use retries: 1). Rationale: the aftersign
  // spec is a heavier cold-start than the other WebGL games — it boots
  // three.js AND the audio-cue pipeline AND waits on window.__game story
  // marks (recognitionTriggeredAt / lineSettledAt / audioCueAt), all
  // gated behind SwiftShader's software renderer. Reviewers on #706
  // (following #453 / #468 / #590) all noted the same cold-start flake
  // shape.
  //
  // 2026-07-19 (#714 iteration 6): bumped 2 → 3. The prior +COLD_START_MS
  // spec-level timeout bump (90s per spec + 60s waitForFunction) did not
  // stabilize the aftersign lane — CI stayed red on the same flake shape
  // #700/#506/#590 documented. The escape hatch named explicitly in
  // `packet-intent-contract.spec.ts` line 40 ("escalate to a wider
  // retry-count bump on aftersign/playwright.config.ts instead of another
  // author push") is this bump. A real assertion bug still fails 4× in a
  // row and stays red; a SwiftShader boot hiccup gets the extra attempt.
  //
  // If a future iteration finds this lane still flaking at retries:3,
  // the correct next move is NOT retries:4 — it's teasing the pure-logic
  // controller checks (packet-intent-contract.spec.ts, which runs
  // `runPacketIntentChecks()` with no page fixture) out of the Playwright
  // lane into a plain Node/Vitest runner so they stop paying the
  // vite-preview + SwiftShader boot tax at all.
  retries: process.env.CI ? 3 : 0,
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
  // Why colocated here vs a dedicated landing lane: the assertion IS an
  // aftersign concern — "is the flagship reachable from the portfolio
  // index?" — so gating it on the aftersign lane is semantically correct.
  // The aftersign filter in ci.yml triggers on aftersign/** and `shared`
  // changes; a pure landing-only edit that breaks the AFTERSIGN card
  // won't fail this lane, but that's an acceptable trade for now — the
  // deploy pipeline copies landing/ verbatim, so the failure mode is
  // "card missing on prod", caught by prod-smoke, not silent.
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
      // Static-serve landing/ via a tiny Node script (no external deps, no
      // registry fetch at test-time). See scripts/serve-landing.mjs for the
      // full rationale — the earlier `npx --yes serve@14 …` variant was
      // fragile in CI because it downloaded `serve` at run-time and any
      // transient npm-registry hiccup surfaced as an aftersign-lane failure
      // with no signal about the actual spec.
      command: "node scripts/serve-landing.mjs 4375",
      url: "http://localhost:4375/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
