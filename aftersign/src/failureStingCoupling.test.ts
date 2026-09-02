// Pure-logic check bundle for the failure-sting AUDIO-VISUAL COUPLING
// contract. Registered in aftersign/pure-runner.ts so it executes under
// `test:aftersign:pure` (a chained precondition of `typecheck:aftersign`
// in package.json).
//
// This bundle pins a claim the sibling `failureStingFeedback.test.ts`
// does NOT: the audio tail (`FAILURE_STING.tone.durationMs` from
// aftersign/failure-sting.js) must be strictly shorter than the visual
// envelope (`DEFAULT_FAILURE_STING_FEEL.durationMs` from
// aftersign/src/failureStingFeedback.ts). If the tone outlasts the
// flash the player hears a "delayed sad trombone" after the visual
// has already settled — the failure feels late.
//
// Contract pinned:
//   AUDIO-VISUAL CEILING (novel):
//     FAILURE_STING.tone.durationMs < DEFAULT_FAILURE_STING_FEEL.durationMs
//     — the audio tail cannot outlive the visual envelope. This is the
//     inequality that couples the two frozen tables across two source
//     files; neither sibling test asserts it.
//
//   T=0 COUPLING FRAME (novel):
//     On the frame the tone one-shot is queued (sampleFailureSting(0)
//     reports `toneQueued === true`), the visual envelope must be
//     active. This ties the .js audio-cue timing to the .ts visual
//     timing at the ignition frame — the sibling test only pins the
//     visual side in isolation.
//
// Why the .ts extension on the failureStingFeedback import and the .js
// extension on the failure-sting import: `--experimental-strip-types`
// requires explicit extensions on every relative specifier (see
// pure-runner.ts header). `.js` on the audio module is the module's
// on-disk extension — Node resolves it directly, tsc under
// moduleResolution:"Bundler" accepts it, and no type stripping is
// needed because the .js file has no TS syntax.

import {
  DEFAULT_FAILURE_STING_FEEL,
} from "./failureStingFeedback.ts";
// eslint-disable-next-line -- .js extension is intentional; see header.
import { FAILURE_STING, sampleFailureSting } from "../failure-sting.js";

const assert = (cond: unknown, msg: string): void => {
  if (!cond) {
    throw new Error(`failureStingCoupling: ${msg}`);
  }
};

export const runFailureStingCouplingChecks = (): void => {
  const feel = DEFAULT_FAILURE_STING_FEEL;
  const toneDurationMs = FAILURE_STING.tone.durationMs;
  const flashDurationMs = feel.durationMs;

  // AUDIO-VISUAL CEILING — the novel inequality that couples the two
  // frozen tables. Strict `<`: equal would still let the tone's last
  // sample fire on the same frame the visual hits zero, which reads
  // as an audio tail hanging in silence.
  assert(
    typeof toneDurationMs === "number" && typeof flashDurationMs === "number",
    `both durations must be numeric (tone=${toneDurationMs}, flash=${flashDurationMs})`,
  );
  assert(
    toneDurationMs < flashDurationMs,
    `FAILURE_STING.tone.durationMs (${toneDurationMs}) must be strictly less than DEFAULT_FAILURE_STING_FEEL.durationMs (${flashDurationMs}) — the audio tail must not outlive the visual envelope`,
  );

  // T=0 COUPLING FRAME — the audio module reports the tone is queued
  // on the ignition frame; the visual module's envelope must be active
  // (and at peak) on that same frame. This ties the .js sample to the
  // .ts feel at the coupling instant.
  const audioT0 = sampleFailureSting(0);
  assert(
    audioT0.toneQueued === true,
    `sampleFailureSting(0).toneQueued must be true — the tone one-shot fires on the ignition frame`,
  );
  assert(
    audioT0.active === true,
    `sampleFailureSting(0).active must be true — the visual envelope is running on the tone-fire frame`,
  );
};
