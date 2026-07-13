export type RecognitionFeedbackPhase = {
  readonly name: 'catch' | 'remember' | 'settle';
  readonly startMs: number;
  readonly durationMs: number;
  readonly cameraPushDegrees: number;
  readonly screenShakePx: number;
  readonly vignetteOpacity: number;
  readonly audioCue: 'soft-click' | 'memory-chime' | 'room-tone';
};

export type IoRecognitionOutcome = 'sealed' | 'opened';

export type RecognitionFeedbackOptions = {
  readonly outcome?: IoRecognitionOutcome;
  readonly reducedMotion?: boolean;
};

export type RecognitionDialogueMotion = {
  readonly activeBeatIndex: IoRecognitionBeatIndex | null;
  readonly lineRevealProgress: number;
  readonly lineOpacity: number;
  readonly lineNudgePx: number;
};

export type RecognitionFeedbackState = {
  readonly elapsedMs: number;
  readonly phase: RecognitionFeedbackPhase['name'];
  readonly outcome: IoRecognitionOutcome;
  readonly reducedMotion: boolean;
  readonly cameraDeltaMeters: number;
  readonly cameraYawDegrees: number;
  /** Back-compat alias for older harness checks; yaw is the visible camera push. */
  readonly cameraPushDegrees: number;
  readonly cameraTargetOffsetMeters: number;
  readonly screenShakePx: number;
  readonly vignetteOpacity: number;
  readonly subtitleScale: number;
  readonly signEmissiveScale: number;
  readonly signGlowProgress: number;
  readonly dialogueActiveBeatIndex: IoRecognitionBeatIndex | null;
  readonly dialogueLineRevealProgress: number;
  readonly dialogueLineOpacity: number;
  readonly dialogueLineNudgePx: number;
  readonly audioCue: RecognitionFeedbackPhase['audioCue'] | 'bell-glass-sting' | 'wooden-click';
  readonly audioCueStarted: boolean;
  readonly audioCueDurationMs: number;
  readonly audioCueGainDb: number;
  readonly branchTint: 'blue' | 'amber';
};

export type IoRecognitionLineId = 'io_return_packet_sealed' | 'io_return_packet_opened';

export type IoRecognitionBeatIndex = 0 | 1 | 2;

export type IoRecognitionBeatLine = {
  readonly beatIndex: IoRecognitionBeatIndex;
  readonly triggerMs: number;
  readonly lineId: IoRecognitionLineId;
  readonly text: string;
};

export const RECOGNITION_FEEDBACK_TOTAL_MS = 1220;
export const RECOGNITION_FEEDBACK_REDUCED_MOTION_MS = 160;
export const RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS = 0.32;
export const RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES = 4;
export const RECOGNITION_FEEDBACK_STING_START_MS = 120;
export const RECOGNITION_FEEDBACK_STING_DURATION_MS = 180;
export const RECOGNITION_FEEDBACK_STING_GAIN_DB = -9;
export const RECOGNITION_FEEDBACK_GLOW_START_MS = 80;
export const RECOGNITION_FEEDBACK_GLOW_DURATION_MS = 140;
export const RECOGNITION_FEEDBACK_GLOW_FROM = 0.8;
export const RECOGNITION_FEEDBACK_GLOW_TO = 1.35;
export const RECOGNITION_FEEDBACK_OPENED_TARGET_OFFSET_METERS = 0.06;
export const RECOGNITION_FEEDBACK_OPENED_CLICK_DELAY_MS = 45;
export const RECOGNITION_DIALOGUE_REVEAL_MS = 180;
export const RECOGNITION_DIALOGUE_NUDGE_PX = 8;

export const IO_RECOGNITION_BEAT_MS = [440, 880, 1220] as const;

const IO_RECOGNITION_LINES: Record<IoRecognitionOutcome, readonly [string, string, string]> = {
  sealed: [
    'You brought it back sealed.',
    'You still leave edges untouched.',
    'I remember that kind of care.',
  ],
  opened: [
    'You opened it before you came.',
    'You still choose truth over tidy.',
    'I remember that kind of courage.',
  ],
};

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
    cameraPushDegrees: RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
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

function resolveDialogueBeatIndex(elapsedMs: number): IoRecognitionBeatIndex | null {
  const safeElapsedMs = Math.max(0, elapsedMs);
  if (safeElapsedMs < IO_RECOGNITION_BEAT_MS[0]) return null;
  if (safeElapsedMs < IO_RECOGNITION_BEAT_MS[1]) return 0;
  if (safeElapsedMs < IO_RECOGNITION_BEAT_MS[2]) return 1;
  return 2;
}

function resolveDialogueMotion(elapsedMs: number): RecognitionDialogueMotion {
  const activeBeatIndex = resolveDialogueBeatIndex(elapsedMs);
  if (activeBeatIndex === null) {
    return {
      activeBeatIndex: null,
      lineRevealProgress: 0,
      lineOpacity: 0,
      lineNudgePx: 0,
    };
  }

  const triggerMs = IO_RECOGNITION_BEAT_MS[activeBeatIndex];
  const revealProgress = easeOutCubic((elapsedMs - triggerMs) / RECOGNITION_DIALOGUE_REVEAL_MS);

  return {
    activeBeatIndex,
    lineRevealProgress: revealProgress,
    lineOpacity: revealProgress,
    lineNudgePx: RECOGNITION_DIALOGUE_NUDGE_PX * (1 - revealProgress),
  };
}

function resolveSignEmissiveScale(elapsedMs: number, reducedMotion: boolean): number {
  const glowWindowMs = reducedMotion
    ? RECOGNITION_FEEDBACK_REDUCED_MOTION_MS
    : RECOGNITION_FEEDBACK_GLOW_DURATION_MS;
  const glowStartMs = reducedMotion ? 0 : RECOGNITION_FEEDBACK_GLOW_START_MS;
  const glowT = clamp01((elapsedMs - glowStartMs) / glowWindowMs);
  const glow = easeOutCubic(glowT);
  return RECOGNITION_FEEDBACK_GLOW_FROM + (RECOGNITION_FEEDBACK_GLOW_TO - RECOGNITION_FEEDBACK_GLOW_FROM) * glow;
}

function resolveAudioCue(
  elapsedMs: number,
  phase: RecognitionFeedbackPhase,
  outcome: IoRecognitionOutcome,
): RecognitionFeedbackState['audioCue'] {
  if (
    outcome === 'opened' &&
    elapsedMs >= RECOGNITION_FEEDBACK_STING_START_MS + RECOGNITION_FEEDBACK_OPENED_CLICK_DELAY_MS &&
    elapsedMs < RECOGNITION_FEEDBACK_STING_START_MS + RECOGNITION_FEEDBACK_OPENED_CLICK_DELAY_MS + RECOGNITION_FEEDBACK_STING_DURATION_MS
  ) {
    return 'wooden-click';
  }

  if (
    elapsedMs >= RECOGNITION_FEEDBACK_STING_START_MS &&
    elapsedMs < RECOGNITION_FEEDBACK_STING_START_MS + RECOGNITION_FEEDBACK_STING_DURATION_MS
  ) {
    return 'bell-glass-sting';
  }

  return phase.audioCue;
}

export function recognitionDialogueForBeat(
  outcome: IoRecognitionOutcome,
  beatIndex: IoRecognitionBeatIndex,
): IoRecognitionBeatLine {
  const text = IO_RECOGNITION_LINES[outcome][beatIndex];
  const lineId: IoRecognitionLineId =
    outcome === 'sealed' ? 'io_return_packet_sealed' : 'io_return_packet_opened';

  return {
    beatIndex,
    triggerMs: IO_RECOGNITION_BEAT_MS[beatIndex],
    lineId,
    text,
  };
}

export function recognitionDialogueAt(
  elapsedMs: number,
  outcome: IoRecognitionOutcome,
): IoRecognitionBeatLine | null {
  const beatIndex = resolveDialogueBeatIndex(elapsedMs);
  if (beatIndex === null) return null;
  return recognitionDialogueForBeat(outcome, beatIndex);
}

export function recognitionFeedbackAt(
  elapsedMs: number,
  options: RecognitionFeedbackOptions = {},
): RecognitionFeedbackState {
  const outcome = options.outcome ?? 'sealed';
  const reducedMotion = options.reducedMotion ?? false;
  const safeElapsedMs = Math.max(0, elapsedMs);
  const dialogueMotion = resolveDialogueMotion(safeElapsedMs);

  if (reducedMotion) {
    const pulse = easeOutCubic(safeElapsedMs / RECOGNITION_FEEDBACK_REDUCED_MOTION_MS);
    const audioCue = safeElapsedMs >= RECOGNITION_FEEDBACK_STING_START_MS && safeElapsedMs < RECOGNITION_FEEDBACK_STING_START_MS + RECOGNITION_FEEDBACK_STING_DURATION_MS
      ? 'bell-glass-sting'
      : 'room-tone';
    return {
      elapsedMs: safeElapsedMs,
      phase: safeElapsedMs < RECOGNITION_FEEDBACK_REDUCED_MOTION_MS ? 'remember' : 'settle',
      outcome,
      reducedMotion: true,
      cameraDeltaMeters: 0,
      cameraYawDegrees: 0,
      cameraPushDegrees: 0,
      cameraTargetOffsetMeters: 0,
      screenShakePx: 0,
      vignetteOpacity: 0,
      subtitleScale: 1,
      signEmissiveScale: RECOGNITION_FEEDBACK_GLOW_FROM + (RECOGNITION_FEEDBACK_GLOW_TO - RECOGNITION_FEEDBACK_GLOW_FROM) * pulse,
      signGlowProgress: pulse,
      dialogueActiveBeatIndex: dialogueMotion.activeBeatIndex,
      dialogueLineRevealProgress: dialogueMotion.lineRevealProgress,
      dialogueLineOpacity: dialogueMotion.lineOpacity,
      dialogueLineNudgePx: 0,
      audioCue,
      audioCueStarted: audioCue === 'bell-glass-sting',
      audioCueDurationMs: audioCue === 'bell-glass-sting' ? RECOGNITION_FEEDBACK_STING_DURATION_MS : 0,
      audioCueGainDb: audioCue === 'bell-glass-sting' ? RECOGNITION_FEEDBACK_STING_GAIN_DB : 0,
      branchTint: outcome === 'sealed' ? 'blue' : 'amber',
    };
  }

  const phase = resolveRecognitionPhase(safeElapsedMs);
  const localT = clamp01((safeElapsedMs - phase.startMs) / phase.durationMs);

  let cameraYawDegrees: number;
  let screenShakePx: number;
  let vignetteOpacity: number;
  let subtitleScale: number;

  if (phase.name === 'catch') {
    const pop = easeOutCubic(localT);
    const shakePulse = 1 + 0.2 * Math.abs(Math.sin(localT * Math.PI * 3));
    cameraYawDegrees = phase.cameraPushDegrees * pop;
    screenShakePx = phase.screenShakePx * (1 - localT) * shakePulse;
    vignetteOpacity = phase.vignetteOpacity * pop;
    subtitleScale = 1 + 0.04 * pop;
  } else if (phase.name === 'remember') {
    const bloom = easeInOutCubic(localT);
    const catchPhase = RECOGNITION_FEEDBACK_PHASES[0];
    const cameraFrom = catchPhase.cameraPushDegrees;
    const vignetteFrom = catchPhase.vignetteOpacity;
    cameraYawDegrees = cameraFrom + (phase.cameraPushDegrees - cameraFrom) * bloom;
    screenShakePx = phase.screenShakePx * Math.sin(localT * Math.PI);
    vignetteOpacity = vignetteFrom + (phase.vignetteOpacity - vignetteFrom) * bloom;
    subtitleScale = 1.04 + 0.02 * Math.sin(localT * Math.PI);
  } else {
    const settle = 1 - easeOutCubic(localT);
    cameraYawDegrees = RECOGNITION_FEEDBACK_PHASES[1].cameraPushDegrees * settle;
    screenShakePx = 0;
    vignetteOpacity = RECOGNITION_FEEDBACK_PHASES[1].vignetteOpacity * settle;
    subtitleScale = 1 + 0.04 * settle;
  }

  const normalizedYaw = cameraYawDegrees / RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES;
  const audioCue = resolveAudioCue(safeElapsedMs, phase, outcome);

  return {
    elapsedMs: safeElapsedMs,
    phase: phase.name,
    outcome,
    reducedMotion: false,
    cameraDeltaMeters: RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS * normalizedYaw,
    cameraYawDegrees,
    cameraPushDegrees: cameraYawDegrees,
    cameraTargetOffsetMeters: outcome === 'opened'
      ? RECOGNITION_FEEDBACK_OPENED_TARGET_OFFSET_METERS * normalizedYaw
      : 0,
    screenShakePx,
    vignetteOpacity,
    subtitleScale,
    signEmissiveScale: resolveSignEmissiveScale(safeElapsedMs, false),
    signGlowProgress: clamp01((safeElapsedMs - RECOGNITION_FEEDBACK_GLOW_START_MS) / RECOGNITION_FEEDBACK_GLOW_DURATION_MS),
    dialogueActiveBeatIndex: dialogueMotion.activeBeatIndex,
    dialogueLineRevealProgress: dialogueMotion.lineRevealProgress,
    dialogueLineOpacity: dialogueMotion.lineOpacity,
    dialogueLineNudgePx: dialogueMotion.lineNudgePx,
    audioCue,
    audioCueStarted: audioCue === 'bell-glass-sting' || audioCue === 'wooden-click',
    audioCueDurationMs: audioCue === 'bell-glass-sting' || audioCue === 'wooden-click'
      ? RECOGNITION_FEEDBACK_STING_DURATION_MS
      : 0,
    audioCueGainDb: audioCue === 'bell-glass-sting' || audioCue === 'wooden-click'
      ? RECOGNITION_FEEDBACK_STING_GAIN_DB
      : 0,
    branchTint: outcome === 'sealed' ? 'blue' : 'amber',
  };
}
