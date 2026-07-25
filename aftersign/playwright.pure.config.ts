import { defineConfig } from "@playwright/test";

// AFTERSIGN pure-logic Playwright lane.
//
// Why this config exists (separate from aftersign/playwright.config.ts):
// several aftersign specs are PURE controller / contract checks — they
// invoke `run*Checks()` functions from `aftersign/src/**` inside a
// `test(...)` block and do NOT use the `{ page }` fixture (no scene, no
// window.__game, no vite-preview). Examples on this branch:
//   - aftersign/e2e/packet-intent-contract.spec.ts
//     (`runPacketIntentChecks()` — 11 controller invariants)
//   - aftersign/e2e/io-recognition-cue-contract.spec.ts
//   - aftersign/e2e/recognition-beat-contract.spec.ts
// Under the main config those specs still pay the full boot tax
// (vite-preview + SwiftShader) even though they need neither, and they
// inherit `retries: 3` — which HIDES a real regression behind up to
// three re-attempts. The escape hatch is named explicitly in
// playwright.config.ts's comment ("teasing the pure-logic controller
// checks out of the Playwright lane so they stop paying the
// vite-preview + SwiftShader boot tax at all"); this file is that lane.
//
// Contract with the main lane:
//  - No webServer.  No browser project.  No launchOptions.  The pure
//    specs never touch a page fixture, so nothing needs to boot.
//  - `retries: 0` — a pure-logic assertion is either true or it isn't;
//    retrying a deterministic check just delays the red signal.
//  - `grep: /-contract\.spec\.ts$/` — convention: any spec whose file
//    ends in `-contract.spec.ts` is a pure controller/contract check.
//    New pure specs pick up the lane automatically by following the
//    naming.  Non-pure specs (scene, save/load, etc.) stay on the main
//    lane where they have a page fixture and a preview server.
//  - The main lane also runs these specs (they still live under
//    aftersign/e2e/), so the pure lane is ADDITIVE gating, not a
//    replacement.  A regression that survives the flaky main-lane
//    retries will still be caught here on the first attempt.
//
// This lane is wired into CI in .github/workflows/ci.yml (aftersign job)
// via `npm run test:aftersign:pure`, placed AFTER `test:e2e:aftersign`
// so the pure step never blocks the (flaky) main lane from running —
// see issue #829 acceptance criteria.
export default defineConfig({
  testDir: "e2e",
  grep: /-contract\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
});
