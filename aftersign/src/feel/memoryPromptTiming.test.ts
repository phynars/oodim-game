// Standalone assertion harness for the AFTERSIGN memory-prompt timing feel model.
//
// Repo convention (see aftersign/src/feel/firstCameraMove.test.ts): run this
// with TypeScript execution; it intentionally avoids Vitest/node:test globals.

import {
  MEMORY_PROMPT_TIMING,
  sampleMemoryPromptTiming,
  sampleMemoryPromptTimeline,
  type MemoryPromptTimingFrame,
} from './memoryPromptTiming.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertFrame(
  actual: MemoryPromptTimingFrame,
  expected: MemoryPromptTimingFrame,
  label: string,
): void {
  for (const key of Object.keys(expected) as (keyof MemoryPromptTimingFrame)[]) {
    if (actual[key] !== expected[key]) {
      throw new Error(
        `${label}.${String(key)}: expected ${String(expected[key])}, got ${String(actual[key])}`,
      );
    }
  }
}

export function checkMemoryPromptDoesNotStealImmediateControl(): void {
  assertFrame(
    sampleMemoryPromptTiming(0),
    {
      elapsedMs: 0,
      phase: 'pre-recognition',
      npcLineOpacity: 0,
      memoryGlyphScale: 0.72,
      playerChoiceOpacity: 0,
      controlLockMsRemaining: MEMORY_PROMPT_TIMING.maximumControlLockMs,
      canSkip: false,
    },
    'memoryPromptTiming.start',
  );

  const beforeRecognition = sampleMemoryPromptTiming(MEMORY_PROMPT_TIMING.recognitionStartMs - 1);
  assert(
    beforeRecognition.phase === 'pre-recognition',
    `memoryPromptTiming.beforeRecognition.phase: expected pre-recognition, got ${beforeRecognition.phase}`,
  );
  assert(
    beforeRecognition.npcLineOpacity === 0,
    `memoryPromptTiming.beforeRecognition.npcLineOpacity: expected 0, got ${beforeRecognition.npcLineOpacity}`,
  );
}

export function checkRecognitionArrivesInsideReadableBeat(): void {
  const frame = sampleMemoryPromptTiming(300);
  assert(
    frame.phase === 'recognition',
    `memoryPromptTiming.recognition.phase: expected recognition, got ${frame.phase}`,
  );
  assert(
    frame.npcLineOpacity >= 0.8,
    `memoryPromptTiming.recognition.npcLineOpacity: expected >= 0.8 by 300ms, got ${frame.npcLineOpacity}`,
  );
  assert(
    frame.memoryGlyphScale >= 0.99 && frame.memoryGlyphScale <= 1.1,
    `memoryPromptTiming.recognition.memoryGlyphScale: expected readable pulse, got ${frame.memoryGlyphScale}`,
  );
}

export function checkChoicesReturnBeforeSkipUnlocks(): void {
  const choicesFrame = sampleMemoryPromptTiming(MEMORY_PROMPT_TIMING.choiceRevealMs);
  assert(
    choicesFrame.phase === 'player-choice',
    `memoryPromptTiming.choiceReveal.phase: expected player-choice, got ${choicesFrame.phase}`,
  );
  assert(
    choicesFrame.controlLockMsRemaining === 0,
    `memoryPromptTiming.choiceReveal.controlLockMsRemaining: expected 0, got ${choicesFrame.controlLockMsRemaining}`,
  );
  assert(
    choicesFrame.canSkip,
    'memoryPromptTiming.choiceReveal.canSkip: expected true once choices are visible',
  );

  const readyFrame = sampleMemoryPromptTiming(700);
  assert(
    readyFrame.playerChoiceOpacity === 1,
    `memoryPromptTiming.choiceReady.playerChoiceOpacity: expected 1, got ${readyFrame.playerChoiceOpacity}`,
  );
}

export function checkTimelineIsMonotonicForReadableElements(): void {
  const timeline = sampleMemoryPromptTimeline([0, 180, 300, 420, 520, 700, 860]);
  for (let index = 1; index < timeline.length; index += 1) {
    const previous = timeline[index - 1];
    const current = timeline[index];
    assert(
      current.npcLineOpacity >= previous.npcLineOpacity,
      `memoryPromptTiming.timeline[${index}].npcLineOpacity: expected monotonic, got ${current.npcLineOpacity} after ${previous.npcLineOpacity}`,
    );
    assert(
      current.playerChoiceOpacity >= previous.playerChoiceOpacity,
      `memoryPromptTiming.timeline[${index}].playerChoiceOpacity: expected monotonic, got ${current.playerChoiceOpacity} after ${previous.playerChoiceOpacity}`,
    );
  }

  const finalFrame = timeline.at(-1);
  assert(finalFrame?.phase === 'settled', `memoryPromptTiming.final.phase: expected settled, got ${finalFrame?.phase}`);
}

export function runMemoryPromptTimingChecks(): void {
  checkMemoryPromptDoesNotStealImmediateControl();
  checkRecognitionArrivesInsideReadableBeat();
  checkChoicesReturnBeforeSkipUnlocks();
  checkTimelineIsMonotonicForReadableElements();
}
