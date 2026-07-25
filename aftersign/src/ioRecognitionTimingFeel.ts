// Feel-timing sampler for Io's recognition beat, DERIVED from the single
// source of truth in `apps/web/src/aftersign/recognitionFeedback.ts`.
//
// The recognitionFeedbackContract owns the beat's raw timing (input lock,
// camera peak, glow envelope, sting window, reduced-motion budget). This
// module surfaces a *timing-feel* view on top of that contract — phase
// labels, ack booleans, normalized eases — so Playwright and dev-tools can
// assert "the beat still feels the way it's authored to feel" without
// re-declaring numbers.
//
// CI-INVOCATION: `runIoRecognitionTimingChecks()` is invoked by the
// Playwright spec `aftersign/e2e/io-recognition-timing-feel-contract.spec.ts`,
// run by the webServer-free pure-logic lane
// (`aftersign/playwright.pure.config.ts`) via `test:aftersign:pure`, which
// the aftersign CI job runs BEFORE `test:e2e:aftersign`. The spec wraps
// the runner in `test(...)` so the invariants ACTUALLY execute in CI (a
// file that only compiles gates nothing — same pattern as
// `recognition-beat-contract.spec.ts` / `packet-intent-contract.spec.ts`).
//
// Import path reaches into apps/web deliberately: the recognitionFeedback
// CONTRACT (with `cameraPeakMs`, `inputLockMs`, `glowRiseMs`, etc.) lives
// there. The local `aftersign/src/recognitionFeedback.ts` is a different,
// older module whose exported shape does not include those keys — see
// `aftersign/src/recognitionBeat.ts` which reaches across the same way for
// the same reason.
//
// Never re-hardcode timing values here. If a check needs a new number, add
// it to `recognitionFeedbackContract` and reference it from here.

import {
  recognitionFeedbackContract,
  sampleRecognitionFeedbackBeat,
  getRecognitionFeedbackDuration,
} from "../../apps/web/src/aftersign/recognitionFeedback";

export type RecognitionPhase = "quiet" | "acknowledge" | "push" | "resolved";

export interface IoRecognitionTimingConfig {
  frameMs: number;
  visualAckMs: number;
  audioAckMs: number;
  cameraPushStartMs: number;
  cameraPushEndMs: number;
  signGlowStartMs: number;
  signGlowEndMs: number;
  controlLockEndMs: number;
  totalMs: number;
  reducedMotionTotalMs: number;
}

export interface IoRecognitionSample {
  tMs: number;
  phase: RecognitionPhase;
  visualAlpha: number;
  audioTriggered: boolean;
  cameraPush: number;
  signGlow: number;
  controlsLocked: boolean;
  reducedMotion: boolean;
}

const FRAME_MS = 1000 / 60;

// A visual "ack" is the smallest sub-window inside the sting startup where
// the player registers something happened. We use the sting start as the
// audio ack (it's when the sting fires) and pin the visual ack at the
// midpoint of the glow rise — that's the beat's shape as authored in
// recognitionFeedbackContract (glow starts at 80ms, sting at 120ms).
const VISUAL_ACK_MS =
  recognitionFeedbackContract.glowStartMs + recognitionFeedbackContract.glowRiseMs / 2;
const AUDIO_ACK_MS = recognitionFeedbackContract.stingStartMs;

// The camera push runs from t=0 to cameraPeakMs; that's the sub-window this
// sampler labels as "push" for phase transitions. The glow rise runs from
// glowStartMs for glowRiseMs; we use that as the sign-glow window.
export const DEFAULT_IO_RECOGNITION_TIMING: IoRecognitionTimingConfig = {
  frameMs: FRAME_MS,
  visualAckMs: VISUAL_ACK_MS,
  audioAckMs: AUDIO_ACK_MS,
  cameraPushStartMs: 0,
  cameraPushEndMs: recognitionFeedbackContract.cameraPeakMs,
  signGlowStartMs: recognitionFeedbackContract.glowStartMs,
  signGlowEndMs:
    recognitionFeedbackContract.glowStartMs + recognitionFeedbackContract.glowRiseMs,
  controlLockEndMs: recognitionFeedbackContract.inputLockMs,
  totalMs: recognitionFeedbackContract.totalMs,
  reducedMotionTotalMs: recognitionFeedbackContract.reducedMotionTotalMs,
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function easeOutCubic(value: number): number {
  const clamped = clamp01(value);
  return 1 - Math.pow(1 - clamped, 3);
}

export interface SampleIoRecognitionOptions {
  reducedMotion?: boolean;
  config?: IoRecognitionTimingConfig;
}

export function sampleIoRecognitionTiming(
  tMs: number,
  options: SampleIoRecognitionOptions = {},
): IoRecognitionSample {
  const config = options.config ?? DEFAULT_IO_RECOGNITION_TIMING;
  const reducedMotion = options.reducedMotion === true;

  if (reducedMotion) {
    // Reduced-motion collapses the beat: no camera push, glow fades linearly
    // over reducedMotionTotalMs, control returns at reducedMotionTotalMs.
    const total = config.reducedMotionTotalMs;
    const glow = clamp01(tMs / total);
    const controlsLocked = tMs < total;
    let phase: RecognitionPhase = "quiet";
    if (tMs >= total) {
      phase = "resolved";
    } else if (tMs >= config.frameMs) {
      phase = "acknowledge";
    }
    return {
      tMs,
      phase,
      visualAlpha: glow,
      audioTriggered: tMs >= 0,
      cameraPush: 0,
      signGlow: glow,
      controlsLocked,
      reducedMotion: true,
    };
  }

  const visualAlpha = easeOutCubic(tMs / config.visualAckMs);
  const cameraPushSpan = Math.max(1, config.cameraPushEndMs - config.cameraPushStartMs);
  const cameraPush = easeOutCubic((tMs - config.cameraPushStartMs) / cameraPushSpan);
  const glowSpan = Math.max(1, config.signGlowEndMs - config.signGlowStartMs);
  const signGlow = easeOutCubic((tMs - config.signGlowStartMs) / glowSpan);
  const controlsLocked = tMs < config.controlLockEndMs;

  let phase: RecognitionPhase = "quiet";
  if (tMs >= config.controlLockEndMs) {
    phase = "resolved";
  } else if (tMs >= config.cameraPushStartMs + config.frameMs) {
    phase = "push";
  } else if (tMs >= config.frameMs) {
    phase = "acknowledge";
  }

  return {
    tMs,
    phase,
    visualAlpha,
    audioTriggered: tMs >= config.audioAckMs,
    cameraPush,
    signGlow,
    controlsLocked,
    reducedMotion: false,
  };
}

function assertRecognition(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function checkIoRecognitionQuietFirstFrame(
  config: IoRecognitionTimingConfig = DEFAULT_IO_RECOGNITION_TIMING,
): void {
  const firstFrame = sampleIoRecognitionTiming(config.frameMs - 0.1, { config });
  assertRecognition(
    !firstFrame.audioTriggered,
    "Io recognition audio must stay quiet during the first frame",
  );
  assertRecognition(
    firstFrame.signGlow === 0,
    "Io recognition sign glow must not rise during the first frame (glow starts at glowStartMs)",
  );
}

export function checkIoRecognitionAcksWithinAuthoredWindow(
  config: IoRecognitionTimingConfig = DEFAULT_IO_RECOGNITION_TIMING,
): void {
  // Cross-check against the contract sampler: at t = stingStartMs + a frame,
  // the contract must be emitting sting gain (stingGainDb non-null) and this
  // sampler must be reporting audioTriggered.
  const t = config.audioAckMs + config.frameMs;
  const contractSample = sampleRecognitionFeedbackBeat(t);
  const feelSample = sampleIoRecognitionTiming(t, { config });
  assertRecognition(
    feelSample.audioTriggered,
    "Io recognition audio must have triggered just past audioAckMs",
  );
  assertRecognition(
    contractSample.stingGainDb !== null,
    "recognitionFeedbackContract must report sting gain just past stingStartMs",
  );
  assertRecognition(
    Math.abs(config.audioAckMs - recognitionFeedbackContract.stingStartMs) < 1,
    "audioAckMs must be derived from recognitionFeedbackContract.stingStartMs",
  );
}

export function checkIoRecognitionCameraEasesThroughMidpoint(
  config: IoRecognitionTimingConfig = DEFAULT_IO_RECOGNITION_TIMING,
): void {
  const midpointMs = (config.cameraPushStartMs + config.cameraPushEndMs) / 2;
  const before = sampleIoRecognitionTiming(midpointMs - config.frameMs, { config }).cameraPush;
  const middle = sampleIoRecognitionTiming(midpointMs, { config }).cameraPush;
  const after = sampleIoRecognitionTiming(midpointMs + config.frameMs, { config }).cameraPush;

  assertRecognition(before > 0 && before < middle, "Io camera push must already be moving before midpoint");
  assertRecognition(middle > 0.65 && middle < 0.95, "Io camera push midpoint must ease, not snap");
  assertRecognition(after > middle && after < 1, "Io camera push must continue after midpoint");
}

export function checkIoRecognitionResolvesWhenControlReturns(
  config: IoRecognitionTimingConfig = DEFAULT_IO_RECOGNITION_TIMING,
): void {
  const resolved = sampleIoRecognitionTiming(config.controlLockEndMs, { config });
  assertRecognition(
    config.controlLockEndMs === recognitionFeedbackContract.inputLockMs,
    "controlLockEndMs must equal recognitionFeedbackContract.inputLockMs",
  );
  assertRecognition(resolved.phase === "resolved", "Io recognition must resolve when control returns");
  assertRecognition(resolved.cameraPush >= 1, "Io recognition must finish the camera push before control returns");
  assertRecognition(resolved.signGlow >= 0.98, "Io recognition must finish the sign glow before control returns");
  assertRecognition(resolved.audioTriggered, "Io recognition sting must have triggered before control returns");
}

export function checkIoRecognitionReducedMotionBranch(
  config: IoRecognitionTimingConfig = DEFAULT_IO_RECOGNITION_TIMING,
): void {
  // Reduced-motion budget must match the contract and must NOT drive the
  // camera. This mirrors the reduced-motion branch inside
  // sampleRecognitionFeedbackBeat.
  assertRecognition(
    config.reducedMotionTotalMs === recognitionFeedbackContract.reducedMotionTotalMs,
    "reducedMotionTotalMs must equal recognitionFeedbackContract.reducedMotionTotalMs",
  );
  assertRecognition(
    getRecognitionFeedbackDuration({ reducedMotion: true }) === config.reducedMotionTotalMs,
    "recognitionFeedbackContract reduced-motion duration must match sampler config",
  );

  const midway = sampleIoRecognitionTiming(config.reducedMotionTotalMs / 2, {
    reducedMotion: true,
    config,
  });
  assertRecognition(midway.reducedMotion === true, "Reduced-motion sample must carry reducedMotion=true");
  assertRecognition(midway.cameraPush === 0, "Reduced-motion must suppress the camera push");
  assertRecognition(midway.controlsLocked, "Reduced-motion must still lock controls while collapsing");

  const settled = sampleIoRecognitionTiming(config.reducedMotionTotalMs, {
    reducedMotion: true,
    config,
  });
  assertRecognition(
    settled.phase === "resolved",
    "Reduced-motion must resolve exactly at reducedMotionTotalMs",
  );
  assertRecognition(!settled.controlsLocked, "Reduced-motion must return control at reducedMotionTotalMs");
}

export function runIoRecognitionTimingChecks(
  config: IoRecognitionTimingConfig = DEFAULT_IO_RECOGNITION_TIMING,
): void {
  checkIoRecognitionQuietFirstFrame(config);
  checkIoRecognitionAcksWithinAuthoredWindow(config);
  checkIoRecognitionCameraEasesThroughMidpoint(config);
  checkIoRecognitionResolvesWhenControlReturns(config);
  checkIoRecognitionReducedMotionBranch(config);
}
