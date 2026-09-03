export type PacketChoice = 'preserve' | 'open';

export type PacketIntentPhase = 'idle' | 'arming' | 'committed' | 'cancelled';

export interface PacketIntentConfig {
  /** Minimum hold before either choice may commit. */
  minHoldMs: number;
  /** Open requires a deliberate drag across the seal after the hold. */
  openDragPx: number;
  /** Preserve requires a deliberate upward lift/slide after the hold. */
  preserveDragPx: number;
  /** Finger travel before minHoldMs that cancels accidental taps. */
  preHoldCancelPx: number;
}

export interface PacketIntentSample {
  timeMs: number;
  x: number;
  y: number;
  pressed: boolean;
}

export interface PacketIntentState {
  phase: PacketIntentPhase;
  choice: PacketChoice | null;
  startedAtMs: number | null;
  startX: number;
  startY: number;
  elapsedMs: number;
  dx: number;
  dy: number;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  minHoldMs: 180,
  openDragPx: 34,
  preserveDragPx: 30,
  preHoldCancelPx: 18,
};

export function createPacketIntentState(): PacketIntentState {
  return {
    phase: 'idle',
    choice: null,
    startedAtMs: null,
    startX: 0,
    startY: 0,
    elapsedMs: 0,
    dx: 0,
    dy: 0,
  };
}

export function updatePacketIntent(
  previous: PacketIntentState,
  sample: PacketIntentSample,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  if (previous.phase === 'committed' || previous.phase === 'cancelled') {
    return previous;
  }

  if (!sample.pressed) {
    if (previous.phase === 'idle') {
      return previous;
    }

    return {
      ...previous,
      phase: previous.choice ? 'committed' : 'cancelled',
    };
  }

  if (previous.phase === 'idle' || previous.startedAtMs === null) {
    return {
      phase: 'arming',
      choice: null,
      startedAtMs: sample.timeMs,
      startX: sample.x,
      startY: sample.y,
      elapsedMs: 0,
      dx: 0,
      dy: 0,
    };
  }

  const elapsedMs = Math.max(0, sample.timeMs - previous.startedAtMs);
  const dx = sample.x - previous.startX;
  const dy = sample.y - previous.startY;
  const distance = Math.hypot(dx, dy);

  if (elapsedMs < config.minHoldMs && distance > config.preHoldCancelPx) {
    return {
      ...previous,
      phase: 'cancelled',
      elapsedMs,
      dx,
      dy,
    };
  }

  const choice =
    elapsedMs >= config.minHoldMs && dx >= config.openDragPx
      ? 'open'
      : elapsedMs >= config.minHoldMs && -dy >= config.preserveDragPx
        ? 'preserve'
        : null;

  return {
    ...previous,
    phase: choice ? 'committed' : 'arming',
    choice,
    elapsedMs,
    dx,
    dy,
  };
}

export function resolvePacketIntent(
  samples: readonly PacketIntentSample[],
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  return samples.reduce(
    (state, sample) => updatePacketIntent(state, sample, config),
    createPacketIntentState(),
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkFastTapDoesNotChoose(): void {
  const result = resolvePacketIntent([
    { timeMs: 0, x: 100, y: 100, pressed: true },
    { timeMs: 90, x: 103, y: 101, pressed: false },
  ]);

  assert(result.phase === 'cancelled', `expected fast tap to cancel, got ${result.phase}`);
  assert(result.choice === null, `expected no choice from fast tap, got ${result.choice}`);
}

export function checkOpenRequiresHeldSealDrag(): void {
  const result = resolvePacketIntent([
    { timeMs: 0, x: 100, y: 100, pressed: true },
    { timeMs: 190, x: 100, y: 100, pressed: true },
    { timeMs: 230, x: 138, y: 102, pressed: true },
  ]);

  assert(result.phase === 'committed', `expected open drag to commit, got ${result.phase}`);
  assert(result.choice === 'open', `expected open choice, got ${result.choice}`);
}

export function checkPreserveRequiresHeldLift(): void {
  const result = resolvePacketIntent([
    { timeMs: 0, x: 100, y: 100, pressed: true },
    { timeMs: 185, x: 100, y: 100, pressed: true },
    { timeMs: 220, x: 101, y: 67, pressed: true },
  ]);

  assert(result.phase === 'committed', `expected preserve lift to commit, got ${result.phase}`);
  assert(result.choice === 'preserve', `expected preserve choice, got ${result.choice}`);
}

export function checkPreHoldSwipeCancels(): void {
  const result = resolvePacketIntent([
    { timeMs: 0, x: 100, y: 100, pressed: true },
    { timeMs: 70, x: 126, y: 100, pressed: true },
  ]);

  assert(result.phase === 'cancelled', `expected pre-hold swipe to cancel, got ${result.phase}`);
  assert(result.choice === null, `expected cancelled swipe to choose nothing, got ${result.choice}`);
}

export function runPacketChoiceIntentChecks(): void {
  checkFastTapDoesNotChoose();
  checkOpenRequiresHeldSealDrag();
  checkPreserveRequiresHeldLift();
  checkPreHoldSwipeCancels();
}
