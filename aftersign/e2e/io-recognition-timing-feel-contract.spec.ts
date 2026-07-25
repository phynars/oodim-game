import { test, expect } from "@playwright/test";
import { runIoRecognitionTimingChecks } from "../src/ioRecognitionTimingFeel";

// CI-gate for the Io recognition TIMING-FEEL sampler.
//
// `runIoRecognitionTimingChecks()` lives at
// `aftersign/src/ioRecognitionTimingFeel.ts` and pins five feel invariants,
// all DERIVED from `recognitionFeedbackContract` (single source of truth
// in `apps/web/src/aftersign/recognitionFeedback.ts`):
//
//   1. Quiet-first-frame: audio has NOT triggered and sign glow is 0
//      one 60Hz frame in (glow authored to start at `glowStartMs=80`,
//      sting authored at `stingStartMs=120`).
//   2. Audio ack window: at `audioAckMs + one frame` this sampler reports
//      `audioTriggered`, AND the contract sampler agrees
//      (`stingGainDb !== null`). `audioAckMs` is derived from the
//      contract, not re-hardcoded.
//   3. Camera-push midpoint eases (~0.875 on easeOutCubic across the
//      full push span) rather than snapping — motion feel invariant.
//   4. Resolve-at-inputLock: at `t=inputLockMs` the phase is `resolved`,
//      camera push is complete, sign glow is complete, and the sting has
//      already fired. `controlLockEndMs` equals the contract's
//      `inputLockMs`, not a re-hardcoded number.
//   5. Reduced-motion branch: suppresses camera push, keeps controls
//      locked mid-collapse, settles to `resolved` + unlocked at exactly
//      `reducedMotionTotalMs`.
//
// This spec runs on the PURE lane (`aftersign/playwright.pure.config.ts`)
// — no webServer, no browser, no SwiftShader — so a failure here is
// always a real regression in the feel contract, never the cold-start
// boot shape documented in #700/#506/#590/#766. The pure config's
// `testMatch` allow-list must include this file's basename; if you rename
// the file, update that list too. Wrapping the runner in `test(...)`
// matters: root package.json ships `@playwright/test` only (no vitest),
// and a file that only compiles gates nothing. Same pattern as
// `packet-intent-contract.spec.ts` / `recognition-beat-contract.spec.ts`.

test.describe("AFTERSIGN Io recognition timing-feel contract", () => {
  test("runIoRecognitionTimingChecks executes every phase / ack / camera / reduced-motion invariant without throwing", () => {
    expect(() => runIoRecognitionTimingChecks()).not.toThrow();
  });
});
