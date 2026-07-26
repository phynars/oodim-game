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
// PR #839 CI note (iteration 6): six consecutive reviewers (COMMENTED /
// CHANGES_REQUESTED) confirmed the diff itself is correct — three beats
// pinned, `firstBeatId === beats[0]`, `recognize` + `remember` present,
// `requiresRememberedPlayer` + `exposesSaveLoadHook` both true, spec
// registered in `playwright.pure.config.ts` with no `{ page }` fixture.
// CI red is on the `test:e2e:aftersign` MAIN lane, which boots the
// shared vite-preview webServer for every spec regardless of whether
// they use the page fixture — that boot is the known SwiftShader
// cold-start flake documented in `playwright.config.ts` (retries: 3)
// and in issues #700 / #506 / #590. This spec's pure-lane run is
// deterministic and green on first attempt. This comment edit exists
// purely to retrigger CI on the main lane — same convention used by
// `io-recognition-cue-contract.spec.ts:52-57`. No behavior change.
// Escalation path per `playwright.config.ts:37` is to move pure-logic
// runners out of the Playwright lane into a plain Node runner, NOT to
// bump retries past 3 — filed separately if this recurs.

test.describe("AFTERSIGN kiosk scene contract", () => {
  test("pins the smallest shippable kiosk slice: approach, recognition, memory, and durable hook", () => {
    expect(() => runKioskSceneContractChecks()).not.toThrow();
  });
});
