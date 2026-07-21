import { test, expect } from "@playwright/test";
import { runRecognitionBeatChecks } from "../src/recognitionBeat.test";

// CI-gate for the Io returning-session recognition-beat contract checks.
//
// `runRecognitionBeatChecks()` lives in aftersign/src/recognitionBeat.test.ts
// and pins twelve invariants across two surfaces:
//
//   1. LINE RESOLVER — `ioRecognitionBeat({ outcome, listenedToRoute })`
//      returns the canonical authored line for each of the four
//      outcome × route-attention pairs, sourced verbatim from
//      `ioReturningSessionLines` (never fabricated by splicing codas onto
//      roots). Also asserts all four lineIds AND all four lines are
//      distinct so no pair silently collapses.
//
//   2. FEEL ENVELOPE — `recognitionBeatProgress(elapsedMs, options)` is a
//      thin delegate to `sampleRecognitionFeedbackBeat` in
//      `apps/web/src/aftersign/recognitionFeedback.ts`. Asserts the beat
//      starts at rest, camera peaks at `recognitionFeedbackContract.cameraPeakMs`,
//      reduced-motion suppresses the camera and uses `reducedMotionTotalMs`,
//      outcome-branch cues (lantern / packetSeal / kioskSign / rainRim /
//      hapticScale / recognition-sting audio) are present, wooden-click timing
//      matches `stingStartMs + openedWoodenClickDelayMs`, and the beat
//      settles at `totalMs`.
//
// Before this spec landed, the checks were TYPECHECKED (via
// `typecheck:aftersign`, tsconfig `include: ["src"]`) but never INVOKED
// by any CI runner — the aftersign lane would greenlight a broken
// invariant. This wrapper matches the established pattern documented in
// `aftersign/e2e/packet-intent-contract.spec.ts` and used by
// `runPacketIntentChecks` / `runFirstCameraMoveChecks`.
//
// The spec intentionally does NOT use the { page } fixture — the checks
// are pure controller/resolver logic (no scene, no window.__game, no
// three.js), so it cannot itself hit the SwiftShader cold-start flake
// shape documented in `aftersign/playwright.config.ts` (retries: 3).
// Any failure here is a real regression, not a boot hiccup.

test.describe("AFTERSIGN Io recognition-beat contract", () => {
  test("runRecognitionBeatChecks executes every line-resolver and feel-envelope invariant without throwing", async () => {
    expect(() => runRecognitionBeatChecks()).not.toThrow();
  });
});
