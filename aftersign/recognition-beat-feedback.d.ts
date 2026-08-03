// Type declarations for the sibling recognition-beat-feedback.js data
// module.  aftersign/tsconfig.json has `include: ["src"]` and no
// `allowJs`, so importing `../recognition-beat-feedback.js` from a
// typechecked source file (e.g. src/recognitionFeedbackBridge.ts)
// would otherwise fail resolution.  This declaration file sits beside
// the .js so TypeScript's Bundler resolver picks up types for the
// `.js` specifier without widening the include set or enabling
// allowJs across the tree.
//
// Shape mirrors recognition-beat-feedback.js exactly.  If a field is
// added/renamed in the .js data, mirror it here (or the bridge's
// typecheck will catch the drift — that's the point).

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
  readonly audioCueIds: readonly string[];
};

export type RecognitionBeatFeedback = {
  readonly durationMs: number;
  readonly reducedMotionDurationMs: number;
  readonly inputLockMs: number;
  readonly cameraPeakMs: number;
  readonly cameraDeltaMeters: number;
  readonly cameraYawDegrees: number;
  readonly openedTargetOffsetMeters: number;
  readonly sealedTargetOffsetMeters: number;
  readonly glowStartMs: number;
  readonly glowRiseMs: number;
  readonly glowFromMultiplier: number;
  readonly glowToMultiplier: number;
  readonly stingStartMs: number;
  readonly stingDurationMs: number;
  readonly stingGainDb: number;
  readonly openedWoodenClickDelayMs: number;
  readonly outcomeCues: {
    readonly sealed: RecognitionBeatOutcomeCues;
    readonly opened: RecognitionBeatOutcomeCues;
  };
};

export const IO_RECOGNITION_BEAT_FEEDBACK: RecognitionBeatFeedback;

export type IoRecognitionBeatEnvelopeOutcome = "sealed" | "opened";

export type IoRecognitionBeatEnvelope = {
  readonly normalized: number;
  readonly cameraDeltaMeters: number;
  readonly cameraYawDegrees: number;
  readonly cameraTargetOffsetMeters: number;
  readonly signGlowMultiplier: number;
  readonly signGlowBoost: number;
  readonly stingGainDb: number | null;
  readonly stingElapsedMs: number | null;
  readonly woodenClickElapsedMs: number | null;
  readonly inputLockMs: number;
  readonly lantern: RecognitionBeatLightCue;
  readonly packetSeal: RecognitionBeatLightCue;
  readonly kioskSign: RecognitionBeatLightCue;
  readonly rainRim: RecognitionBeatLightCue;
  readonly hapticScale: RecognitionBeatHapticCue;
  readonly audioCueIds: readonly string[];
};

export function ioRecognitionBeatEnvelopeAt(
  elapsedMs: number,
  outcome?: IoRecognitionBeatEnvelopeOutcome,
  feedback?: RecognitionBeatFeedback,
): IoRecognitionBeatEnvelope;
