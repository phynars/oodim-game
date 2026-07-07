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

export const RECOGNITION_FEEDBACK_TOTAL_MS = 1220;

export const RECOGNITION_FEEDBACK_PHASES: readonly RecognitionFeedbackPhase[] = [
  {
    name: 'catch',
    startMs: 0,
    durationMs: 180,
    cameraPushDegrees: 1,
    screenShakePx: 1.5,
    vignetteOpacity: 0.2,
    audioCue: 'soft-click',
  },
  {
    name: 'remember',
    startMs: 180,
    durationMs: 520,
    cameraPushDegrees: 4,
    screenShakePx: 0.6,
    vignetteOpacity: 0.32,
    audioCue: 'memory-chime',
  },
  {
    name: 'settle',
    startMs: 700,
    durationMs: 520,
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

function resolveRecognitionPhase(elapsedMs: number): RecognitionFeedbackPhase {
  let phase = RECOGNITION_FEEDBACK_PHASES[0];
  for (let index = 1; index < RECOGNITION_FEEDBACK_PHASES.length; index += 1) {
    const candidate = RECOGNITION_FEEDBACK_PHASES[index];
    if (elapsedMs < candidate.startMs) {
      break;
    }
    phase = candidate;
  }
  return phase;
}

export function recognitionFeedbackAt(elapsedMs: number): RecognitionFeedbackState {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const phase = resolveRecognitionPhase(safeElapsedMs);
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
    const cameraFrom = catchPhase.cameraPushDegrees;
    const vignetteFrom = catchPhase.vignetteOpacity;
    return {
      elapsedMs: safeElapsedMs,
      phase: phase.name,
      cameraPushDegrees: cameraFrom + (phase.cameraPushDegrees - cameraFrom) * bloom,
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
