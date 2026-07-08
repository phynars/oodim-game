export type RecognitionOutcome = 'sealed' | 'opened';

export type RecognitionFeedbackPhaseName = 'approach' | 'hit' | 'settle';

export type RecognitionFeedbackAudioCue = 'wood-click' | 'bell-glass' | 'room-tone';

export type RecognitionFeedbackMemoryBeat = {
  readonly kind: 'io_packet_return';
  readonly outcome: RecognitionOutcome;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly cameraDeltaMeters: number;
  readonly cameraYawDegrees: number;
  readonly inputLockMs: number;
  readonly lineId: string;
};

export type RecognitionFeedbackState = {
  readonly elapsedMs: number;
  readonly outcome: RecognitionOutcome;
  readonly reducedMotion: boolean;
  readonly totalMs: number;
  readonly phase: RecognitionFeedbackPhaseName;
  readonly cameraDeltaMeters: number;
  readonly cameraYawDegrees: number;
  readonly signGlowScale: number;
  readonly stingGainDb: number;
  readonly stingActive: boolean;
  readonly audioCue: RecognitionFeedbackAudioCue;
  readonly colorGrade: 'cool-sealed' | 'warm-opened';
  readonly cameraTargetOffsetY: number;
  readonly woodClickAtMs: number | null;
  readonly memoryBeat: RecognitionFeedbackMemoryBeat;
};

export const RECOGNITION_FEEDBACK_TOTAL_MS = 1220;
export const RECOGNITION_FEEDBACK_REDUCED_MOTION_TOTAL_MS = 160;

const RECOGNITION_CAMERA_DELTA_METERS = 0.32;
const RECOGNITION_CAMERA_YAW_DEGREES = 4;
const SIGN_GLOW_START_MS = 80;
const SIGN_GLOW_DURATION_MS = 140;
const SIGN_GLOW_FROM = 0.8;
const SIGN_GLOW_TO = 1.35;
const STING_START_MS = 120;
const STING_DURATION_MS = 180;
const STING_GAIN_DB = -9;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

function lineIdForOutcome(outcome: RecognitionOutcome): string {
  return outcome === 'sealed' ? 'io_return_packet_sealed' : 'io_return_packet_opened';
}

function baseColorForOutcome(outcome: RecognitionOutcome): 'cool-sealed' | 'warm-opened' {
  return outcome === 'sealed' ? 'cool-sealed' : 'warm-opened';
}

function targetOffsetYForOutcome(outcome: RecognitionOutcome): number {
  return outcome === 'sealed' ? 0.06 : -0.04;
}

function woodClickAtForOutcome(outcome: RecognitionOutcome): number | null {
  return outcome === 'opened' ? STING_START_MS + 45 : null;
}

function phaseAt(elapsedMs: number, totalMs: number): RecognitionFeedbackPhaseName {
  if (elapsedMs < STING_START_MS) return 'approach';
  if (elapsedMs < totalMs - 240) return 'hit';
  return 'settle';
}

function signGlowAt(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    const pulseT = clamp01(elapsedMs / RECOGNITION_FEEDBACK_REDUCED_MOTION_TOTAL_MS);
    return 1 + 0.2 * Math.sin(pulseT * Math.PI);
  }

  const t = clamp01((elapsedMs - SIGN_GLOW_START_MS) / SIGN_GLOW_DURATION_MS);
  return SIGN_GLOW_FROM + (SIGN_GLOW_TO - SIGN_GLOW_FROM) * easeOutCubic(t);
}

function cameraEnvelopeAt(elapsedMs: number, totalMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;

  const peakMs = 700;
  if (elapsedMs <= peakMs) {
    return easeOutCubic(elapsedMs / peakMs);
  }

  const settleWindow = Math.max(1, totalMs - peakMs);
  return 1 - easeOutCubic((elapsedMs - peakMs) / settleWindow);
}

function buildMemoryBeat(
  startedAt: number,
  endedAt: number,
  outcome: RecognitionOutcome,
  inputLockMs: number,
): RecognitionFeedbackMemoryBeat {
  return {
    kind: 'io_packet_return',
    outcome,
    startedAt,
    endedAt,
    cameraDeltaMeters: RECOGNITION_CAMERA_DELTA_METERS,
    cameraYawDegrees: RECOGNITION_CAMERA_YAW_DEGREES,
    inputLockMs,
    lineId: lineIdForOutcome(outcome),
  };
}

export function recognitionFeedbackAt(
  elapsedMs: number,
  options: {
    readonly outcome?: RecognitionOutcome;
    readonly reducedMotion?: boolean;
    readonly startedAt?: number;
    readonly targetWindow?: (Window & typeof globalThis) | null;
  } = {},
): RecognitionFeedbackState {
  const outcome = options.outcome ?? 'sealed';
  const reducedMotion = options.reducedMotion ?? false;
  const totalMs = reducedMotion ? RECOGNITION_FEEDBACK_REDUCED_MOTION_TOTAL_MS : RECOGNITION_FEEDBACK_TOTAL_MS;
  const clampedElapsedMs = Math.max(0, Math.min(elapsedMs, totalMs));
  const startedAt = options.startedAt ?? 0;
  const endedAt = startedAt + totalMs;

  const envelope = cameraEnvelopeAt(clampedElapsedMs, totalMs, reducedMotion);
  const cameraDeltaMeters = RECOGNITION_CAMERA_DELTA_METERS * envelope;
  const cameraYawDegrees = RECOGNITION_CAMERA_YAW_DEGREES * envelope;
  const stingActive = clampedElapsedMs >= STING_START_MS && clampedElapsedMs <= STING_START_MS + STING_DURATION_MS;

  const state: RecognitionFeedbackState = {
    elapsedMs: clampedElapsedMs,
    outcome,
    reducedMotion,
    totalMs,
    phase: phaseAt(clampedElapsedMs, totalMs),
    cameraDeltaMeters,
    cameraYawDegrees,
    signGlowScale: signGlowAt(clampedElapsedMs, reducedMotion),
    stingGainDb: STING_GAIN_DB,
    stingActive,
    audioCue: stingActive ? 'bell-glass' : outcome === 'opened' ? 'wood-click' : 'room-tone',
    colorGrade: baseColorForOutcome(outcome),
    cameraTargetOffsetY: targetOffsetYForOutcome(outcome),
    woodClickAtMs: woodClickAtForOutcome(outcome),
    memoryBeat: buildMemoryBeat(startedAt, endedAt, outcome, totalMs),
  };

  const resolvedWindow =
    options.targetWindow ??
    (typeof window === 'undefined' ? null : (window as Window & typeof globalThis));
  if (resolvedWindow) {
    publishRecognitionMemoryBeat(resolvedWindow, state);
  }

  return state;
}

export function publishRecognitionMemoryBeat(
  targetWindow: Window & typeof globalThis,
  state: RecognitionFeedbackState,
): RecognitionFeedbackMemoryBeat {
  const game = ((targetWindow as any).__game ??= {});
  const story = (game.story ??= {});
  story.currentNpcId = 'io';
  story.memoryBeat = state.memoryBeat;
  return state.memoryBeat;
}
