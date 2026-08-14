export type ReturnRecognitionState = {
  visits: number;
  lastChoiceId?: string;
  lastDeliveryId?: string;
  trust: number;
};

export type ReturnRecognitionLine = {
  text: string;
  tone: 'first-meeting' | 'remembered-choice' | 'remembered-delivery' | 'strained-return';
  memoryCueMs: number;
};

const MIN_MEMORY_CUE_MS = 420;
const MAX_MEMORY_CUE_MS = 900;

export function clampTrust(trust: number): number {
  if (!Number.isFinite(trust)) return 0;
  return Math.max(-1, Math.min(1, trust));
}

export function chooseReturnRecognitionLine(state: ReturnRecognitionState): ReturnRecognitionLine {
  const trust = clampTrust(state.trust);

  if (state.visits <= 0) {
    return {
      text: 'You are new to the rainline. Stay close; the signals lie after dark.',
      tone: 'first-meeting',
      memoryCueMs: MIN_MEMORY_CUE_MS,
    };
  }

  if (trust < -0.35) {
    return {
      text: 'You came back. I remember the cost of your last promise.',
      tone: 'strained-return',
      memoryCueMs: MAX_MEMORY_CUE_MS,
    };
  }

  if (state.lastDeliveryId) {
    return {
      text: `You made the ${state.lastDeliveryId} delivery. The station is still breathing because of it.`,
      tone: 'remembered-delivery',
      memoryCueMs: 560,
    };
  }

  if (state.lastChoiceId) {
    return {
      text: `Last time, you chose ${state.lastChoiceId}. I have not forgotten.`,
      tone: 'remembered-choice',
      memoryCueMs: 640,
    };
  }

  return {
    text: 'Back again. Good. The city keeps receipts, and so do I.',
    tone: 'remembered-choice',
    memoryCueMs: 700,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function checkReturnRecognitionFeelsImmediate(): void {
  const line = chooseReturnRecognitionLine({
    visits: 1,
    lastDeliveryId: 'signal-cache',
    trust: 0.2,
  });

  assert(line.tone === 'remembered-delivery', 'returning players should hear the delivered memory first');
  assert(
    line.memoryCueMs >= MIN_MEMORY_CUE_MS && line.memoryCueMs <= MAX_MEMORY_CUE_MS,
    'memory recognition cue must land inside the readable reaction window',
  );
  assert(line.text.includes('signal-cache'), 'recognition line should name the remembered delivery');
}

export function checkStrainedReturnOverridesGenericMemory(): void {
  const line = chooseReturnRecognitionLine({
    visits: 2,
    lastChoiceId: 'break-the-relay',
    lastDeliveryId: 'signal-cache',
    trust: -0.8,
  });

  assert(line.tone === 'strained-return', 'low trust should color the return before content recall');
  assert(line.memoryCueMs === MAX_MEMORY_CUE_MS, 'strained returns should pause long enough to read as intentional');
}

export function runReturnRecognitionFeelChecks(): void {
  checkReturnRecognitionFeelsImmediate();
  checkStrainedReturnOverridesGenericMemory();
}
