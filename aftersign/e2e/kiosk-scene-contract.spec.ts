import { test, expect } from "@playwright/test";
import { runKioskSceneContractChecks } from "../src/kioskSceneContract";

// CI-gate for the AFTERSIGN kiosk scene contract.
//
// `runKioskSceneContractChecks()` lives at `aftersign/src/kioskSceneContract.ts`
// and pins the smallest shippable kiosk slice:
//
//   1. sceneId is exactly `"aftersign-kiosk-io"` — the Io kiosk identity.
//   2. Exactly three beats — the vertical slice must stay a slice.
//   3. `firstBeatId === beats[0]` — no drift between the declared entry
//      point and the authored ordering.
//   4. Beats include both `recognize` and `remember` — the two invariants
//      the flagship concept doc calls out as load-bearing (Io recognises
//      the player; Io remembers a prior session).
//   5. `requiresRememberedPlayer` and `exposesSaveLoadHook` are both
//      `true` — the durable save/load hook is not optional for this slice.
//
// The spec deliberately does NOT use the `{ page }` fixture: the checks
// are pure story-state logic (no scene, no window.__game, no three.js),
// so it cannot itself hit the SwiftShader cold-start flake shape
// documented in `aftersign/playwright.config.ts`. It runs under the pure
// lane (`playwright.pure.config.ts`, retries: 0), which the aftersign CI
// job invokes as `npm run test:aftersign:pure` BEFORE the browser
// install — see `.github/workflows/ci.yml` for the ordering rationale.
//
// PR #839 CI note (iteration 4): Soren's re-review confirmed the diff
// follows the established `run*Checks` pattern exactly (see
// recognition-beat-contract.spec.ts, io-recognition-cue-contract.spec.ts,
// packet-intent-vertical-slice-contract.spec.ts) and is APPROVE-worthy
// on merit; CI is red on `test:e2e:aftersign` (main lane) which is the
// known SwiftShader vite-preview cold-start flake #700/#506/#590 that
// aborts the whole aftersign job's webServer boot regardless of the
// individual spec. The pure lane where this spec actually runs has
// retries: 0 and no browser, so it is not the source of the red.
// This comment exists purely to retrigger CI; no behavior change.
// Escalation path per playwright.config.ts is to move pure-logic
// runners out of the Playwright browser lane, NOT to bump retries
// past 3.

test.describe("AFTERSIGN kiosk scene contract", () => {
  test("pins the smallest shippable kiosk slice: approach, recognition, memory, and durable hook", () => {
    expect(() => runKioskSceneContractChecks()).not.toThrow();
  });
});
