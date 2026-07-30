export type MemoryPromptPhase =
  | 'pre-recognition'
  | 'recognition'
  | 'player-choice'
  | 'settled';

export type MemoryPromptTimingFrame = {
  elapsedMs: number;
  phase: MemoryPromptPhase;
  npcLineOpacity: number;
  memoryGlyphScale: number;
  playerChoiceOpacity: number;
  controlLockMsRemaining: number;
  canSkip: boolean;
};

export type MemoryPromptTimingConfig = {
  recognitionStartMs: number;
  recognitionRiseMs: number;
  glyphPeakMs: number;
  choiceRevealMs: number;
  choiceRiseMs: number;
  settleMs: number;
  maximumControlLockMs: number;
  skipEnabledMs: number;
};

export const MEMORY_PROMPT_TIMING: MemoryPromptTimingConfig = {
  recognitionStartMs: 180,
  recognitionRiseMs: 220,
  glyphPeakMs: 320,
  choiceRevealMs: 520,
  choiceRiseMs: 180,
  settleMs: 860,
  maximumControlLockMs: 420,
  skipEnabledMs: 520,
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

function easeOutBack(value: number): number {
  const t = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function sampleMemoryPromptTiming(
  elapsedMs: number,
  config: MemoryPromptTimingConfig = MEMORY_PROMPT_TIMING,
): MemoryPromptTimingFrame {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const recognitionProgress = easeOutCubic(
    (safeElapsedMs - config.recognitionStartMs) / config.recognitionRiseMs,
  );
  const choiceProgress = easeOutCubic(
    (safeElapsedMs - config.choiceRevealMs) / config.choiceRiseMs,
  );
  const glyphProgress = easeOutBack(safeElapsedMs / config.glyphPeakMs);
  const controlLockMsRemaining = Math.max(0, config.maximumControlLockMs - safeElapsedMs);

  let phase: MemoryPromptPhase = 'pre-recognition';
  if (safeElapsedMs >= config.settleMs) {
    phase = 'settled';
  } else if (safeElapsedMs >= config.choiceRevealMs) {
    phase = 'player-choice';
  } else if (safeElapsedMs >= config.recognitionStartMs) {
    phase = 'recognition';
  }

  return {
    elapsedMs: safeElapsedMs,
    phase,
    npcLineOpacity: round(recognitionProgress),
    memoryGlyphScale: round(0.72 + 0.28 * glyphProgress),
    playerChoiceOpacity: round(choiceProgress),
    controlLockMsRemaining: round(controlLockMsRemaining),
    canSkip: safeElapsedMs >= config.skipEnabledMs,
  };
}

export function sampleMemoryPromptTimeline(
  samplesMs: readonly number[],
  config: MemoryPromptTimingConfig = MEMORY_PROMPT_TIMING,
): MemoryPromptTimingFrame[] {
  return samplesMs.map((elapsedMs) => sampleMemoryPromptTiming(elapsedMs, config));
}
