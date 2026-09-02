// Pure-logic check bundle for the failure-sting AUDIO-VISUAL COUPLING
// contract. Registered in aftersign/pure-runner.ts so it executes under
// `test:aftersign:pure` (a chained precondition of `typecheck:aftersign`
// in package.json).
//
// This bundle pins a claim NEITHER sibling test asserts:
//
//   AUDIO-VISUAL CEILING (novel):
//     FAILURE_STING.tone.durationMs < DEFAULT_FAILURE_STING_FEEL.durationMs
//     — the audio tail (120ms one-shot in aftersign/failure-sting.js)
//     must be strictly shorter than the visual envelope (180ms in
//     aftersign/src/failureStingFeedback.ts). If the tone outlives the
//     flash the player hears a "delayed sad trombone" after the visual
//     has already settled and the failure feels late.
//
// The sibling `failureStingFeedback.test.ts` pins the visual envelope's
// internal math (flashAlpha@0, flashAlpha@durationMs, remainingMs@0,
// reduced-motion split) but never touches the audio table. The sibling
// `../failure-sting.test.js` (node:test) pins the audio envelope's own
// shape (`assertFailureStingCueShape`) but never touches the visual
// table. The inequality that couples the two frozen tables therefore
// has NO existing home — this bundle is that home.
//
// CROSS-BOUNDARY PIN, NOT CROSS-BOUNDARY IMPORT
// ---------------------------------------------
// aftersign/tsconfig.json scopes `include: ["src"]` with no `allowJs`
// (documented in the tsconfig header — widening or enabling allowJs
// re-opens the ~25-file burn-down and turns the blocking
// `typecheck:aftersign` gate red on latent errors). So the audio
// module's tone.durationMs is pinned here as a LOCAL numeric literal
// mirroring the frozen table in `aftersign/failure-sting.js`. This
// follows the same pattern the e2e uses for state feel constants
// (`.toBe(0.34)` against DEFAULT_FAILURE_STING_FEEL.flashAlpha): the
// production value is frozen; the check restates it and asserts a
// relation the other side cannot see.
//
// If aftersign/failure-sting.js changes FAILURE_STING.tone.durationMs
// the sibling `failure-sting.test.js` still asserts the audio envelope
// shape against the on-disk table; the mismatch surfaces there as a
// shape failure, and the AUDIO_TONE_DURATION_MS mirror below must be
// updated in the same PR (search for `AUDIO_TONE_DURATION_MS` — this
// file is the only mirror site).

import { DEFAULT_FAILURE_STING_FEEL } from "./failureStingFeedback.ts";

// Mirror of FAILURE_STING.tone.durationMs in aftersign/failure-sting.js.
// Do not edit in isolation — see header.
const AUDIO_TONE_DURATION_MS = 120;

const assert = (cond: unknown, msg: string): void => {
  if (!cond) {
    throw new Error(`failureStingCoupling: ${msg}`);
  }
};

export const runFailureStingCouplingChecks = (): void => {
  const flashDurationMs = DEFAULT_FAILURE_STING_FEEL.durationMs;

  // AUDIO-VISUAL CEILING — the novel inequality that couples the two
  // frozen tables. Strict `<`: equal would still let the tone's last
  // sample fire on the same frame the visual hits zero, which reads
  // as an audio tail hanging in silence.
  assert(
    typeof AUDIO_TONE_DURATION_MS === "number" &&
      typeof flashDurationMs === "number",
    `both durations must be numeric (tone=${AUDIO_TONE_DURATION_MS}, flash=${flashDurationMs})`,
  );
  assert(
    AUDIO_TONE_DURATION_MS < flashDurationMs,
    `FAILURE_STING.tone.durationMs (${AUDIO_TONE_DURATION_MS}) must be strictly less than DEFAULT_FAILURE_STING_FEEL.durationMs (${flashDurationMs}) — the audio tail must not outlive the visual envelope`,
  );

  // HEADROOM FLOOR — the tail must clear the flash by at least one
  // 60Hz frame (~16.67ms), otherwise the last audio sample and the
  // last visual frame can land on the same wall-clock tick and the
  // "audio survives the flash" perceptual bug reappears despite the
  // strict `<` above passing. This is the second half of the coupling
  // contract and, like the ceiling, has no home in either sibling.
  const headroomMs = flashDurationMs - AUDIO_TONE_DURATION_MS;
  const frameMs = 1000 / 60;
  assert(
    headroomMs >= frameMs,
    `audio-visual headroom (${headroomMs}ms) must be at least one 60Hz frame (${frameMs.toFixed(2)}ms) — tone=${AUDIO_TONE_DURATION_MS}ms, flash=${flashDurationMs}ms`,
  );
};
