import {
  recognitionFeedbackAt,
  RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
  RECOGNITION_FEEDBACK_TOTAL_MS,
} from "./recognitionFeedback.ts";
import { IO_RECOGNITION_BEAT_FEEDBACK } from "../recognition-beat-feedback.js";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

// Bridge from the RecognitionFeedbackState contract (recognitionFeedback.ts)
// to the DOM cue envelope shape that applyRecognitionDomFeedback consumes.
// The contract module is fixed; we adapt on the way out.
export const recognitionEnvelopeAt = (
  elapsedMs,
  outcome = "sealed",
  feedback,
) => {
  const safeOutcome = outcome === "opened" ? "opened" : "sealed";
  const base = recognitionFeedbackAt(elapsedMs, { outcome: safeOutcome });

  const peakDelta = feedback?.cameraDeltaMeters ?? RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS;
  const peakYaw = feedback?.cameraYawDegrees ?? RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES;

  const deltaRatio = RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS === 0
    ? 0
    : peakDelta / RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS;
  const yawRatio = RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES === 0
    ? 0
    : peakYaw / RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES;

  // signGlowBoost is added to signLight.intensity every frame in the
  // render loop (main.js:1727: `7.4 + ... + recognitionMotion.signGlowBoost + ...`).
  // The contract's signEmissiveScale rises 0.8 → 1.35 via easeOutCubic
  // over [glowStartMs, glowStartMs+glowDurationMs] — so `scale - 1` is
  // NEGATIVE (down to -0.2) before glowStartMs, crosses zero mid-rise,
  // then peaks at +0.35. That pre-bloom DIP is authored: the sign light
  // dims below its 7.4 baseline for a beat before it blooms — the
  // "catch your breath" moment the reviewer flagged in #1008. Do NOT
  // clamp to [0,1] — that floors the dip and flattens the temporal feel
  // (peak magnitudes look identical to e2e bands, but the dim beat is
  // gone). The unclamped delta matches the old
  // ioRecognitionBeatEnvelopeAt shape exactly (see
  // recognition-beat-feedback.js: `Number((signGlowMultiplier - 1).toFixed(3))`).
  const signGlowBoost = base.signEmissiveScale - 1;

  // Cue keys (lantern/packetSeal/kioskSign/rainRim/hapticScale) are consumed by
  // applyRecognitionDomFeedback via cueIntensity(cue, elapsedMs), which reads
  // { startMs, durationMs, easing }. Pass through from the outcome table so the
  // DOM-layer recognition beat lights up.
  const cues = IO_RECOGNITION_BEAT_FEEDBACK.outcomeCues[safeOutcome];

  return {
    // DOM-feedback contract:
    normalized: clamp01(Math.max(0, elapsedMs) / RECOGNITION_FEEDBACK_TOTAL_MS),
    lantern: cues.lantern,
    packetSeal: cues.packetSeal,
    kioskSign: cues.kioskSign,
    rainRim: cues.rainRim,
    hapticScale: cues.hapticScale,
    // Camera/light bridge fields already consumed by main.js:
    cameraDeltaMeters: Number((base.cameraDeltaMeters * deltaRatio).toFixed(3)),
    cameraYawDegrees: Number((base.cameraYawDegrees * yawRatio).toFixed(2)),
    signGlowBoost: Number(signGlowBoost.toFixed(3)),
  };
};
