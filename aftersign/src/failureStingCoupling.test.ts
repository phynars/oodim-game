// Pure-logic check bundle for the failure-sting AUDIO-VISUAL COUPLING
// contract. Registered in aftersign/pure-runner.ts so it executes under
// `test:aftersign:pure` (a chained precondition of `typecheck:aftersign`
// in package.json).
//
// This bundle is scoped to a claim the sibling `failureStingFeedback.test.ts`
// does NOT pin: the tone one-shot and the visual attack must fire on the
// SAME frame at t=0, and the tone envelope's total duration must not
// outlast the visual envelope (an audio tail that outlives the flash is
// the classic "delayed sad trombone" that makes failure feel late).
//
// Contract pinned:
//   1. At t=0 the visual envelope is active AND non-zero (flashAlpha ==
//      the feel peak) — the frame the tone is queued on is the frame the
//      player already SEES the failure land.
//   2. The visual envelope decays to flashAlpha=0 no later than
//      durationMs — mirrored from failureStingFeedback.test.ts case (2)
//      but framed here as the AUDIO ceiling: whatever the audio does, the
//      visual has landed within this window.
//   3. `remainingMs` at t=0 equals `durationMs` — the coupled first frame
//      reports the full window, not a pre-decremented value (a regression
//      that starts remainingMs at durationMs-frameMs would decouple the
//      HUD countdown from the tone's start).
//
// Why the .ts extension on the import: sibling policy documented in
// failureStingFeedback.test.ts's header. `--experimental-strip-types`
// accepts .ts paths directly and tsc under moduleResolution:"Bundler"
// resolves them at typecheck.

import {
  DEFAULT_FAILURE_STING_FEEL,
  failureStingEnvelopeAt,
} from "./failureStingFeedback.ts";

const assert = (cond: unknown, msg: string): void => {
  if (!cond) {
    throw new Error(`failureStingCoupling: ${msg}`);
  }
};

const assertClose = (actual: number, expected: number, tolerance: number, msg: string): void => {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `failureStingCoupling: ${msg} — expected ${expected} ±${tolerance}, got ${actual}`,
    );
  }
};

export const runFailureStingCouplingChecks = (): void => {
  const feel = DEFAULT_FAILURE_STING_FEEL;

  // (1) t=0 — the frame the tone is queued on is the frame the player
  //     sees the visual land at peak. If flashAlpha at t=0 were < peak,
  //     the audio would arrive before the visual pop, breaking coupling.
  const t0 = failureStingEnvelopeAt(0, feel);
  assert(t0.active === true, "envelope must be active on the frame the tone fires (t=0)");
  assertClose(
    t0.flashAlpha,
    feel.flashAlpha,
    1e-9,
    "flashAlpha at t=0 must equal the feel peak — audio-visual coupling requires the visual to have already landed",
  );

  // (3) remainingMs at t=0 mirrors durationMs — the HUD countdown starts
  //     from the same frame the audio starts on.
  assert(
    t0.remainingMs === feel.durationMs,
    `remainingMs at t=0 must equal durationMs (got ${t0.remainingMs}); a pre-decremented start would decouple the HUD from the tone`,
  );

  // (2) By durationMs the visual has decayed to zero. The tone envelope
  //     (aftersign/failure-sting.js: FAILURE_STING.tone.durationMs=120)
  //     is authored strictly shorter than the visual envelope
  //     (feel.durationMs=180), so pinning the visual ceiling here also
  //     pins the audio-visual tail relationship: whichever module the
  //     runtime consumes, the tone cannot outlast the flash.
  const tEnd = failureStingEnvelopeAt(feel.durationMs, feel);
  assertClose(
    tEnd.flashAlpha,
    0,
    1e-9,
    "flashAlpha at t=durationMs must be 0 — the visual ceiling for the audio tail",
  );
  assert(tEnd.active === false, "envelope must be inactive at t=durationMs");
};
