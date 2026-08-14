// Pure-logic check bundle for the AFTERSIGN Io return-recognition beat
// feel envelope. Registered in aftersign/pure-runner.ts so it executes
// under `test:aftersign:pure` (a chained precondition of
// `typecheck:aftersign` in package.json).
//
// Consumer status (honest disclosure, addresses PR #1164 review):
//   The module this bundle pins — apps/web/src/aftersign/ioRecognitionBeat.feel.ts
//   — is NOT wired into the shipped aftersign surface yet. Zero
//   references from aftersign/main.js; and the vitest lane
//   (apps/web/src/aftersign/vitest.config.ts) only includes
//   windowGameHarnessBoot.test.ts + ioRecognitionExpectedLine.consumer.test.ts,
//   so the sibling `ioRecognitionBeat.feel.test.ts` does NOT execute
//   there either. The prior review claim that it was "already consumed
//   by the vitest suite" was wrong; this bundle keeps the feel-envelope
//   CONSTANTS frozen under the deterministic pure lane so that when
//   the renderer wiring lands, the phase timing / camera-push peak /
//   signGlow envelope / subtitle fade / outcome tints / totalMs budget
//   cannot silently drift underneath it. Follow-up work — wiring
//   ioRecognitionBeat.feel.ts into the return-recognition beat
//   renderer — is tracked separately; until then, treat this bundle
//   as a harness-only pin of the feel math, run because
//   `test:aftersign:pure` is a chained precondition of
//   `typecheck:aftersign`.
//
// Extension-resolution contract:
//   The imported module (../../../apps/web/src/aftersign/ioRecognitionBeat.feel.ts)
//   has ZERO relative imports of its own (grep-verified — the whole
//   module is self-contained pure math), so its subgraph terminates
//   here with a single .ts-extensioned hop. Node's
//   --experimental-strip-types resolves it; tsc under
//   moduleResolution:"Bundler" + allowImportingTsExtensions accepts it.
//   Cross-package hops into apps/web/src/aftersign are already
//   precedented in this lane — see aftersign/src/recognitionBeat.ts,
//   which imports apps/web/src/aftersign/recognitionFeedback.ts the
//   same way.
//
// Invariants pinned (verbatim mirror of ioRecognitionBeat.feel.test.ts's
// vitest expectations, so a divergence here breaks BOTH lanes together
// rather than drifting silently):
//   1. Held-breath before recognition — at t=90ms the phase is
//      preRecognitionHold, camera has not moved, subtitle is invisible.
//   2. Camera push wakes the sign glow — at t=520ms the phase is
//      cameraPush, cameraPushDegrees is within [2.1, 2.4], signGlow
//      has crossed 1.0, vignette has risen past 0.12.
//   3. Line delivery lands after the camera move — at t=820ms the
//      phase is lineDelivery, subtitle is fully opaque, cameraPush
//      is essentially at its peak (2.4°).
//   4. Afterglow decays instead of popping — at t=1680ms (end)
//      signGlow AND subtitle are both 0, and glow at 1550 > glow at
//      1680 (monotonic decay across the tail).
//   5. Outcome tints — sealed keeps its warm #f6c86a, opened keeps
//      its cut #b44b4b.
//   6. Total-budget cap — feel.totalMs stays <= 1700ms so the beat
//      cannot silently stretch past the "does not steal control for
//      too long" ceiling the vitest suite asserts.

import {
  AFTERSIGN_IO_RECOGNITION_BEAT_FEEL,
  sampleAftersignIoRecognitionBeat,
} from "../../../apps/web/src/aftersign/ioRecognitionBeat.feel.ts";

const assert = (cond: unknown, msg: string): void => {
  if (!cond) {
    throw new Error(`ioRecognitionBeatFeel: ${msg}`);
  }
};

const assertClose = (actual: number, expected: number, tolerance: number, msg: string): void => {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `ioRecognitionBeatFeel: ${msg} — expected ${expected} ±${tolerance}, got ${actual}`,
    );
  }
};

export const runReturnRecognitionFeelChecks = (): void => {
  const feel = AFTERSIGN_IO_RECOGNITION_BEAT_FEEL;

  // (0) Total-budget cap — the vitest suite asserts totalMs <= 1700
  //     as the "does not steal control for too long" guard. Pin it in
  //     the pure lane too so a shipping-day nudge to the constant
  //     fails deterministically.
  assert(
    feel.totalMs <= 1700,
    `feel.totalMs must stay within the 1700ms control-return budget (got ${feel.totalMs})`,
  );

  // (1) Held breath — pre-recognition hold.
  const held = sampleAftersignIoRecognitionBeat(90);
  assert(held.phase === "preRecognitionHold", `t=90 phase must be preRecognitionHold (got ${held.phase})`);
  assertClose(held.cameraPushDegrees, 0, 1e-9, "t=90 cameraPushDegrees must be 0");
  assertClose(held.cameraLiftPx, 0, 1e-9, "t=90 cameraLiftPx must be 0");
  assertClose(held.subtitleAlpha, 0, 1e-9, "t=90 subtitleAlpha must be 0");
  assert(
    held.bellGainDb <= feel.bellStingPeakDb,
    `t=90 bellGainDb must not exceed peak (peak=${feel.bellStingPeakDb}, got ${held.bellGainDb})`,
  );

  // (2) Camera push wakes the sign glow.
  const push = sampleAftersignIoRecognitionBeat(520);
  assert(push.phase === "cameraPush", `t=520 phase must be cameraPush (got ${push.phase})`);
  assert(
    push.cameraPushDegrees >= 2.1 && push.cameraPushDegrees <= 2.4,
    `t=520 cameraPushDegrees must land in [2.1, 2.4] (got ${push.cameraPushDegrees})`,
  );
  assert(
    push.cameraLiftPx >= 8.8,
    `t=520 cameraLiftPx must be >= 8.8 (got ${push.cameraLiftPx})`,
  );
  assert(
    push.signGlowIntensity >= 1,
    `t=520 signGlowIntensity must have crossed 1.0 (got ${push.signGlowIntensity})`,
  );
  assert(
    push.vignetteAlpha > 0.12,
    `t=520 vignetteAlpha must exceed 0.12 (got ${push.vignetteAlpha})`,
  );

  // (3) Line delivery lands after the camera move.
  const line = sampleAftersignIoRecognitionBeat(820);
  assert(line.phase === "lineDelivery", `t=820 phase must be lineDelivery (got ${line.phase})`);
  assertClose(line.subtitleAlpha, 1, 1e-9, "t=820 subtitleAlpha must be 1");
  assertClose(
    line.cameraPushDegrees,
    feel.cameraPushDegrees,
    0.02,
    "t=820 cameraPushDegrees must be at (or within 0.02 of) its peak",
  );

  // (4) Afterglow decays, does not pop.
  const tailMid = sampleAftersignIoRecognitionBeat(1550);
  const tailEnd = sampleAftersignIoRecognitionBeat(1680);
  const tailStart = sampleAftersignIoRecognitionBeat(1420);
  assert(tailStart.phase === "afterglow", `t=1420 phase must be afterglow (got ${tailStart.phase})`);
  assert(
    tailMid.signGlowIntensity > tailEnd.signGlowIntensity,
    `signGlowIntensity must decay monotonically across the tail (t=1550: ${tailMid.signGlowIntensity}, t=1680: ${tailEnd.signGlowIntensity})`,
  );
  assertClose(tailEnd.signGlowIntensity, 0, 1e-9, "t=1680 signGlowIntensity must land at 0");
  assertClose(tailEnd.subtitleAlpha, 0, 1e-9, "t=1680 subtitleAlpha must land at 0");

  // (5) Outcome tints — warm sealed, cut opened.
  assert(
    feel.outcomeTint.sealed === "#f6c86a",
    `outcomeTint.sealed drifted from #f6c86a (got ${feel.outcomeTint.sealed})`,
  );
  assert(
    feel.outcomeTint.opened === "#b44b4b",
    `outcomeTint.opened drifted from #b44b4b (got ${feel.outcomeTint.opened})`,
  );
};
