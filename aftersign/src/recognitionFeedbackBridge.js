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

  const signGlowBoost = clamp01(base.signEmissiveScale - 1);

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
