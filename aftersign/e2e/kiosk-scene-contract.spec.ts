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

test.describe("AFTERSIGN kiosk scene contract", () => {
  test("pins the smallest shippable kiosk slice: approach, recognition, memory, and durable hook", () => {
    expect(() => runKioskSceneContractChecks()).not.toThrow();
  });
});
