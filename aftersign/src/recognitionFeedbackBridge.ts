import {
  recognitionFeedbackAt,
  RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
  RECOGNITION_FEEDBACK_TOTAL_MS,
  type IoRecognitionOutcome,
} from "./recognitionFeedback.ts";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

// DOM-cue shape consumed by applyRecognitionDomFeedback via
// cueIntensity(cue, elapsedMs) — needs { startMs, durationMs, easing }.
// The intensityFrom/intensityTo/color/audioId fields are read by the
// DOM layer for tint + audio cue routing; keep them in the same shape
// as the sibling JS data table so main.js doesn't need to translate.
export type RecognitionBeatCueEasing =
  | "easeOutCubic"
  | "easeInOutSine"
  | "bell";

export type RecognitionBeatLightCue = {
  readonly startMs: number;
  readonly durationMs: number;
  readonly easing: RecognitionBeatCueEasing;
  readonly intensityFrom: number;
  readonly intensityTo: number;
  readonly color: string;
  readonly audioId?: string;
};

export type RecognitionBeatHapticCue = {
  readonly startMs: number;
  readonly durationMs: number;
  readonly easing: RecognitionBeatCueEasing;
  readonly amplitude: number;
};

export type RecognitionBeatOutcomeCues = {
  readonly lantern: RecognitionBeatLightCue;
  readonly packetSeal: RecognitionBeatLightCue;
  readonly kioskSign: RecognitionBeatLightCue;
  readonly rainRim: RecognitionBeatLightCue;
  readonly hapticScale: RecognitionBeatHapticCue;
};

// Inlined mirror of `outcomeCues` from ../recognition-beat-feedback.js.
// KEEP IN SYNC: if a field in the .js data table changes, mirror it
// here. The bridge test (#4/#5) pins the sealed/opened palette + audio
// tokens (lantern.color, packetSeal.audioId), so a divergence between
// this table and the .js data will surface loudly.
//
// Why inline instead of importing from ../recognition-beat-feedback.js:
// aftersign/tsconfig.json has `include: ["src"]` and no `allowJs`; a
// sibling .d.ts covers `.js` resolution for the browser lane but the
// pure-logic test lane (`test:aftersign:pure`, Node's
// --experimental-strip-types) executes this file directly and needs
// every import to resolve WITHOUT crossing into JS at runtime — a
// TypeScript-only subgraph keeps the runner deterministic and avoids
// the `.js`-from-`src/` precedent that no other aftersign/src file
// uses. `IO_RECOGNITION_BEAT_FEEDBACK` in main.js remains the render
// loop's source of truth; this table is the DOM-cue projection the
// bridge exposes.
const OUTCOME_CUES: {
  readonly sealed: RecognitionBeatOutcomeCues;
  readonly opened: RecognitionBeatOutcomeCues;
} = {
  sealed: {
    lantern: {
      startMs: 70,
      durationMs: 360,
      easing: "easeOutCubic",
      intensityFrom: 0.72,
      intensityTo: 1.18,
      color: "#f5c978",
    },
    packetSeal: {
      startMs: 128,
      durationMs: 180,
      easing: "bell",
      intensityFrom: 0.55,
      intensityTo: 1.35,
      color: "#ffcf70",
      audioId: "seal-wax-click",
    },
    kioskSign: {
      startMs: 90,
      durationMs: 420,
      easing: "easeInOutSine",
      intensityFrom: 0.9,
      intensityTo: 1.24,
      color: "#ffd99a",
    },
    rainRim: {
      startMs: 160,
      durationMs: 520,
      easing: "easeOutCubic",
      intensityFrom: 0.4,
      intensityTo: 0.64,
      color: "#9cc8ff",
    },
    hapticScale: {
      startMs: 128,
      durationMs: 54,
      easing: "bell",
      amplitude: 0.34,
    },
  },
  opened: {
    lantern: {
      startMs: 60,
      durationMs: 440,
      easing: "easeOutCubic",
      intensityFrom: 0.7,
      intensityTo: 1.42,
      color: "#ffe1a8",
    },
    packetSeal: {
      startMs: 165,
      durationMs: 210,
      easing: "bell",
      intensityFrom: 0.48,
      intensityTo: 1.05,
      color: "#b7d8ff",
      audioId: "seal-paper-tear",
    },
    kioskSign: {
      startMs: 80,
      durationMs: 500,
      easing: "easeInOutSine",
      intensityFrom: 0.9,
      intensityTo: 1.38,
      color: "#ffe6b8",
    },
    rainRim: {
      startMs: 140,
      durationMs: 620,
      easing: "easeOutCubic",
      intensityFrom: 0.42,
      intensityTo: 0.82,
      color: "#bfe1ff",
    },
    hapticScale: {
      startMs: 165,
      durationMs: 72,
      easing: "bell",
      amplitude: 0.22,
    },
  },
};

export type RecognitionEnvelopeFeedback = {
  readonly cameraDeltaMeters?: number;
  readonly cameraYawDegrees?: number;
};

export type RecognitionEnvelope = {
  readonly normalized: number;
  readonly lantern: RecognitionBeatLightCue;
  readonly packetSeal: RecognitionBeatLightCue;
  readonly kioskSign: RecognitionBeatLightCue;
  readonly rainRim: RecognitionBeatLightCue;
  readonly hapticScale: RecognitionBeatHapticCue;
  readonly cameraDeltaMeters: number;
  readonly cameraYawDegrees: number;
  readonly signGlowBoost: number;
};

// Bridge from the RecognitionFeedbackState contract (recognitionFeedback.ts)
// to the DOM cue envelope shape that applyRecognitionDomFeedback consumes.
// The contract module is fixed; we adapt on the way out.
export const recognitionEnvelopeAt = (
  elapsedMs: number,
  outcome: IoRecognitionOutcome | string = "sealed",
  feedback?: RecognitionEnvelopeFeedback,
): RecognitionEnvelope => {
  const safeOutcome: IoRecognitionOutcome = outcome === "opened" ? "opened" : "sealed";
  const base = recognitionFeedbackAt(elapsedMs, { outcome: safeOutcome });

  const peakDelta = feedback?.cameraDeltaMeters ?? RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS;
  const peakYaw = feedback?.cameraYawDegrees ?? RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES;

  const deltaRatio =
    RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS === 0
      ? 0
      : peakDelta / RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS;
  const yawRatio =
    RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES === 0
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
  const cues = OUTCOME_CUES[safeOutcome];

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
