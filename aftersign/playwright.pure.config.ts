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
//  - `testMatch` — an EXPLICIT allow-list of the pure specs.  Playwright's
//    `grep` filters on TEST TITLE, not filename, so a regex like
//    `/-contract\.spec\.ts$/` would still discover every
//    `*-contract.spec.ts` file (the whole `aftersign/e2e/` dir),
//    then match zero titles and run nothing — or worse, match a title
//    that happens to contain that substring.  Using `testMatch` narrows
//    at the DISCOVERY layer so files that need `{ page }` + the
//    vite-preview webServer never enter this lane in the first place.
//    Adding a new pure spec is a one-line edit here — deliberate, not
//    accidental via naming.
//  - The main lane also runs these specs (they still live under
//    aftersign/e2e/), so the pure lane is ADDITIVE gating, not a
//    replacement.  A regression that survives the flaky main-lane
//    retries will still be caught here on the first attempt.
//
// This lane is wired into CI in .github/workflows/ci.yml (aftersign job)
// via `npm run test:aftersign:pure`, placed BEFORE `test:e2e:aftersign`
// (and before `playwright install`) — the pure lane launches no browser
// and is deterministic (retries: 0), so it costs seconds and gives a
// first-attempt green signal on the pure-controller contracts. Issue
// #829 acceptance criteria explicitly allow "before or alongside"; the
// non-chaining constraint (AC3) is about the main lane's flakiness
// affecting a chained step, which does not apply here since the pure
// lane is deterministic.
export default defineConfig({
  testDir: "e2e",
  // Explicit allow-list: only specs that are documented to NOT use the
  // `{ page }` fixture belong on this lane.  Do not switch to a glob
  // that captures every `*-contract.spec.ts` — most of those files DO
  // use `{ page }` and require the main lane's vite-preview webServer.
  testMatch: [
    "packet-intent-contract.spec.ts",
    "packet-intent-vertical-slice-contract.spec.ts",
    "io-recognition-cue-contract.spec.ts",
    "recognition-beat-contract.spec.ts",
    "io-recognition-timing-feel-contract.spec.ts",
    "first-camera-move-feel-contract.spec.ts",
    "memory-prompt-timing-feel-contract.spec.ts",
    "io-return-memory-beat-contract.spec.ts",
    "kiosk-scene-contract.spec.ts",
    "orra-recognition-memory-contract.spec.ts",
    "hard-navigation-save-survival-contract.spec.ts",
    "flagship-runnable-slice-spine-contract.spec.ts",
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
});
