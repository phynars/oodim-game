export type RecognitionFeedbackPhase = {
  readonly name: 'catch' | 'remember' | 'settle';
  readonly startMs: number;
  readonly durationMs: number;
  readonly cameraPushDegrees: number;
  readonly screenShakePx: number;
  readonly vignetteOpacity: number;
  readonly audioCue: 'soft-click' | 'memory-chime' | 'room-tone';
};

export type RecognitionFeedbackState = {
  readonly elapsedMs: number;
  readonly phase: RecognitionFeedbackPhase['name'];
  readonly cameraPushDegrees: number;
  readonly screenShakePx: number;
  readonly vignetteOpacity: number;
  readonly subtitleScale: number;
  readonly audioCue: RecognitionFeedbackPhase['audioCue'];
};

export const RECOGNITION_FEEDBACK_TOTAL_MS = 900;

export const RECOGNITION_FEEDBACK_PHASES: readonly RecognitionFeedbackPhase[] = [
  {
    name: 'catch',
    startMs: 0,
    durationMs: 140,
    cameraPushDegrees: 0.7,
    screenShakePx: 1.5,
    vignetteOpacity: 0.18,
    audioCue: 'soft-click',
  },
  {
    name: 'remember',
    startMs: 140,
    durationMs: 360,
    cameraPushDegrees: 1.8,
    screenShakePx: 0.6,
    vignetteOpacity: 0.28,
    audioCue: 'memory-chime',
  },
  {
    name: 'settle',
    startMs: 500,
    durationMs: 400,
    cameraPushDegrees: 0,
    screenShakePx: 0,
    vignetteOpacity: 0,
    audioCue: 'room-tone',
  },
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOutCubic = (t: number): number => {
  const k = clamp01(t);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};

export function recognitionFeedbackAt(elapsedMs: number): RecognitionFeedbackState {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const phase = [...RECOGNITION_FEEDBACK_PHASES]
    .reverse()
    .find((candidate) => safeElapsedMs >= candidate.startMs) ?? RECOGNITION_FEEDBACK_PHASES[0];
  const localT = clamp01((safeElapsedMs - phase.startMs) / phase.durationMs);

  if (phase.name === 'catch') {
    const pop = easeOutCubic(localT);
    return {
      elapsedMs: safeElapsedMs,
      phase: phase.name,
      cameraPushDegrees: phase.cameraPushDegrees * pop,
      screenShakePx: phase.screenShakePx * (1 - localT),
      vignetteOpacity: phase.vignetteOpacity * pop,
      subtitleScale: 1 + 0.04 * pop,
      audioCue: phase.audioCue,
    };
  }

  if (phase.name === 'remember') {
    const bloom = easeInOutCubic(localT);
    const catchPhase = RECOGNITION_FEEDBACK_PHASES[0];
    // Bloom FROM catch's end values TO remember's targets — no V-dip at t=140.
    const cameraFrom = catchPhase.cameraPushDegrees;
    const vignetteFrom = catchPhase.vignetteOpacity;
    return {
      elapsedMs: safeElapsedMs,
      phase: phase.name,
      cameraPushDegrees: cameraFrom + (phase.cameraPushDegrees - cameraFrom) * bloom,
      // Catch's shake decays to 0 by t=140; remember blooms from 0 up to
      // its target then eases back to 0 — no spike at the boundary.
      screenShakePx: phase.screenShakePx * Math.sin(localT * Math.PI),
      vignetteOpacity: vignetteFrom + (phase.vignetteOpacity - vignetteFrom) * bloom,
      subtitleScale: 1.04 + 0.02 * Math.sin(localT * Math.PI),
      audioCue: phase.audioCue,
    };
  }

  const settle = 1 - easeOutCubic(localT);
  return {
    elapsedMs: safeElapsedMs,
    phase: phase.name,
    cameraPushDegrees: RECOGNITION_FEEDBACK_PHASES[1].cameraPushDegrees * settle,
    screenShakePx: 0,
    vignetteOpacity: RECOGNITION_FEEDBACK_PHASES[1].vignetteOpacity * settle,
    subtitleScale: 1 + 0.04 * settle,
    audioCue: phase.audioCue,
  };
}
