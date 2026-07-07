export type RecognitionBeatPhase =
  | "approach"
  | "notice"
  | "recognition"
  | "release";

export type RecognitionBeatCue = Readonly<{
  phase: RecognitionBeatPhase;
  startMs: number;
  durationMs: number;
  cameraPushDegrees: number;
  screenShakePx: number;
  signGlow: number;
  audioGain: number;
}>;

export type RecognitionBeatSample = Readonly<{
  elapsedMs: number;
  phase: RecognitionBeatPhase;
  cameraPushDegrees: number;
  screenShakePx: number;
  signGlow: number;
  audioGain: number;
}>;

const BEAT_CUES: readonly RecognitionBeatCue[] = [
  {
    phase: "approach",
    startMs: 0,
    durationMs: 220,
    cameraPushDegrees: 0.8,
    screenShakePx: 0,
    signGlow: 0.2,
    audioGain: 0.1,
  },
  {
    phase: "notice",
    startMs: 220,
    durationMs: 140,
    cameraPushDegrees: 1.6,
    screenShakePx: 0.75,
    signGlow: 0.55,
    audioGain: 0.35,
  },
  {
    phase: "recognition",
    startMs: 360,
    durationMs: 180,
    cameraPushDegrees: 2.4,
    screenShakePx: 1.25,
    signGlow: 1,
    audioGain: 0.7,
  },
  {
    phase: "release",
    startMs: 540,
    durationMs: 260,
    cameraPushDegrees: 0,
    screenShakePx: 0,
    signGlow: 0.35,
    audioGain: 0.22,
  },
];

export const recognitionBeat = Object.freeze({
  totalMs: 800,
  holdFramesAt60Hz: 11,
  easing: "cubic-bezier(0.18, 0.9, 0.22, 1)",
  cues: BEAT_CUES,
});

export function sampleRecognitionBeat(elapsedMs: number): RecognitionBeatSample {
  const clampedMs = clamp(elapsedMs, 0, recognitionBeat.totalMs);
  const cue = cueAt(clampedMs);
  const localMs = clampedMs - cue.startMs;
  const t = clamp(localMs / cue.durationMs, 0, 1);
  const eased = easeOutBack(t);

  return {
    elapsedMs: clampedMs,
    phase: cue.phase,
    cameraPushDegrees: round(cue.cameraPushDegrees * eased, 3),
    screenShakePx: round(cue.screenShakePx * shakeEnvelope(t), 3),
    signGlow: round(cue.signGlow * eased, 3),
    audioGain: round(cue.audioGain * easeOutQuad(t), 3),
  };
}

export function recognitionBeatAcceptanceSamples(): readonly RecognitionBeatSample[] {
  return [0, 220, 360, 540, recognitionBeat.totalMs].map(sampleRecognitionBeat);
}

function cueAt(elapsedMs: number): RecognitionBeatCue {
  return (
    BEAT_CUES.find(
      (cue) => elapsedMs >= cue.startMs && elapsedMs < cue.startMs + cue.durationMs,
    ) ?? BEAT_CUES[BEAT_CUES.length - 1]
  );
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function shakeEnvelope(t: number): number {
  return Math.sin(t * Math.PI) * (1 - t * 0.35);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
