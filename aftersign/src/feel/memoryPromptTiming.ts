export type MemoryPromptPhase = "pre-recognition" | "recognizing" | "choice-reveal" | "choice-ready";

export interface MemoryPromptTimingConfig {
  frameMs: number;
  recognitionLineReadableMs: number;
  choiceRevealMs: number;
  choiceReadyMs: number;
  npcLineFadeMs: number;
  choiceFadeMs: number;
}

export interface MemoryPromptTimingSample {
  tMs: number;
  phase: MemoryPromptPhase;
  npcLineOpacity: number;
  choiceOpacity: number;
  controlsLocked: boolean;
  skipAllowed: boolean;
}

export const DEFAULT_MEMORY_PROMPT_TIMING: MemoryPromptTimingConfig = {
  frameMs: 1000 / 60,
  recognitionLineReadableMs: 300,
  choiceRevealMs: 520,
  choiceReadyMs: 700,
  npcLineFadeMs: 240,
  choiceFadeMs: 180,
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function easeOutCubic(value: number): number {
  const clamped = clamp01(value);
  return 1 - Math.pow(1 - clamped, 3);
}

export function sampleMemoryPromptTiming(
  tMs: number,
  config: MemoryPromptTimingConfig = DEFAULT_MEMORY_PROMPT_TIMING,
): MemoryPromptTimingSample {
  const npcLineOpacity = easeOutCubic(tMs / config.npcLineFadeMs);
  const choiceOpacity = easeOutCubic((tMs - config.choiceRevealMs) / config.choiceFadeMs);
  const controlsLocked = tMs < config.choiceRevealMs;
  const skipAllowed = tMs >= config.choiceRevealMs;

  let phase: MemoryPromptPhase = "pre-recognition";
  if (tMs >= config.choiceReadyMs) {
    phase = "choice-ready";
  } else if (tMs >= config.choiceRevealMs) {
    phase = "choice-reveal";
  } else if (tMs >= config.frameMs) {
    phase = "recognizing";
  }

  return {
    tMs,
    phase,
    npcLineOpacity,
    choiceOpacity,
    controlsLocked,
    skipAllowed,
  };
}

function assertMemoryPrompt(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function checkMemoryPromptFirstFrameQuiet(
  config: MemoryPromptTimingConfig = DEFAULT_MEMORY_PROMPT_TIMING,
): void {
  const sample = sampleMemoryPromptTiming(config.frameMs - 0.1, config);
  assertMemoryPrompt(
    sample.phase === "pre-recognition",
    "Memory prompt must not advance past pre-recognition during the first frame",
  );
  assertMemoryPrompt(
    sample.choiceOpacity === 0,
    "Memory prompt choices must stay hidden during the first frame",
  );
  assertMemoryPrompt(
    sample.controlsLocked,
    "Memory prompt must keep controls locked before the recognition beat is readable",
  );
}

export function checkMemoryPromptLineReadableByRecognitionWindow(
  config: MemoryPromptTimingConfig = DEFAULT_MEMORY_PROMPT_TIMING,
): void {
  const sample = sampleMemoryPromptTiming(config.recognitionLineReadableMs, config);
  assertMemoryPrompt(
    sample.phase === "recognizing",
    "Memory prompt must still be in the authored recognition beat before choices reveal",
  );
  assertMemoryPrompt(
    sample.npcLineOpacity >= 0.9,
    "Memory prompt NPC line must be readable by the recognition-line window",
  );
  assertMemoryPrompt(
    sample.choiceOpacity === 0,
    "Memory prompt must not reveal choices before the recognition line is readable",
  );
}

export function checkMemoryPromptChoiceRevealReturnsControl(
  config: MemoryPromptTimingConfig = DEFAULT_MEMORY_PROMPT_TIMING,
): void {
  const sample = sampleMemoryPromptTiming(config.choiceRevealMs, config);
  assertMemoryPrompt(
    sample.phase === "choice-reveal",
    "Memory prompt must enter choice-reveal exactly at the authored reveal time",
  );
  assertMemoryPrompt(
    !sample.controlsLocked,
    "Memory prompt must return control when choices reveal",
  );
  assertMemoryPrompt(
    sample.skipAllowed,
    "Memory prompt must allow skip once choices reveal",
  );
}

export function checkMemoryPromptOpacityIsMonotonic(
  config: MemoryPromptTimingConfig = DEFAULT_MEMORY_PROMPT_TIMING,
): void {
  const samples = [
    0,
    config.frameMs,
    config.recognitionLineReadableMs,
    config.choiceRevealMs,
    config.choiceRevealMs + config.choiceFadeMs / 2,
    config.choiceReadyMs,
  ].map((tMs) => sampleMemoryPromptTiming(tMs, config));

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    assertMemoryPrompt(
      current.npcLineOpacity >= previous.npcLineOpacity,
      "Memory prompt NPC line opacity must never retreat across the authored beat",
    );
    assertMemoryPrompt(
      current.choiceOpacity >= previous.choiceOpacity,
      "Memory prompt choice opacity must never retreat across the authored beat",
    );
  }
}

export function runMemoryPromptTimingChecks(
  config: MemoryPromptTimingConfig = DEFAULT_MEMORY_PROMPT_TIMING,
): void {
  checkMemoryPromptFirstFrameQuiet(config);
  checkMemoryPromptLineReadableByRecognitionWindow(config);
  checkMemoryPromptChoiceRevealReturnsControl(config);
  checkMemoryPromptOpacityIsMonotonic(config);
}
