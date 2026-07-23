export type PacketDecision = 'undecided' | 'preserve-sealed' | 'open-seal';

export interface PacketIntentConfig {
  /** Seconds the player must keep steady pressure on the seal before it opens. */
  openHoldSeconds: number;
  /** Pointer travel in normalized screen units that cancels an open hold. */
  cancelMoveRadius: number;
  /** Seconds under this value count as a light preserve tap instead of an open attempt. */
  preserveTapSeconds: number;
}

export interface PacketIntentState {
  decision: PacketDecision;
  holdSeconds: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  isPressingSeal: boolean;
  canceledByMotion: boolean;
}

export interface PacketIntentSnapshot {
  decision: PacketDecision;
  holdSeconds: number;
  progress: number;
  isPressingSeal: boolean;
  canceledByMotion: boolean;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldSeconds: 0.42,
  cancelMoveRadius: 0.04,
  preserveTapSeconds: 0.18,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const distance = (aX: number, aY: number, bX: number, bY: number): number => {
  const dx = aX - bX;
  const dy = aY - bY;
  return Math.hypot(dx, dy);
};

export const createPacketIntentState = (x = 0, y = 0): PacketIntentState => ({
  decision: 'undecided',
  holdSeconds: 0,
  originX: x,
  originY: y,
  currentX: x,
  currentY: y,
  isPressingSeal: false,
  canceledByMotion: false,
});

export const beginPacketIntent = (
  state: PacketIntentState,
  x: number,
  y: number,
): PacketIntentState => {
  if (state.decision !== 'undecided') {
    return state;
  }

  return {
    ...state,
    holdSeconds: 0,
    originX: x,
    originY: y,
    currentX: x,
    currentY: y,
    isPressingSeal: true,
    canceledByMotion: false,
  };
};

export const stepPacketIntent = (
  state: PacketIntentState,
  dtSeconds: number,
  x: number,
  y: number,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState => {
  if (state.decision !== 'undecided' || !state.isPressingSeal) {
    return state;
  }

  const movedTooFar = distance(state.originX, state.originY, x, y) > config.cancelMoveRadius;
  const canceledByMotion = state.canceledByMotion || movedTooFar;
  const holdSeconds = canceledByMotion
    ? state.holdSeconds
    : state.holdSeconds + Math.max(0, dtSeconds);

  return {
    ...state,
    decision: holdSeconds >= config.openHoldSeconds ? 'open-seal' : 'undecided',
    holdSeconds,
    currentX: x,
    currentY: y,
    isPressingSeal: holdSeconds < config.openHoldSeconds,
    canceledByMotion,
  };
};

export const endPacketIntent = (
  state: PacketIntentState,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState => {
  if (state.decision !== 'undecided') {
    return { ...state, isPressingSeal: false };
  }

  if (!state.isPressingSeal) {
    return state;
  }

  return {
    ...state,
    decision:
      !state.canceledByMotion && state.holdSeconds <= config.preserveTapSeconds
        ? 'preserve-sealed'
        : 'undecided',
    isPressingSeal: false,
  };
};

export const snapshotPacketIntent = (
  state: PacketIntentState,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentSnapshot => ({
  decision: state.decision,
  holdSeconds: state.holdSeconds,
  progress: clamp01(state.holdSeconds / config.openHoldSeconds),
  isPressingSeal: state.isPressingSeal,
  canceledByMotion: state.canceledByMotion,
});

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const checkPacketIntentFeel = (): void => {
  const config = DEFAULT_PACKET_INTENT_CONFIG;

  let tap = beginPacketIntent(createPacketIntentState(), 0.5, 0.5);
  tap = stepPacketIntent(tap, 0.1, 0.5, 0.5, config);
  tap = endPacketIntent(tap, config);
  assert(tap.decision === 'preserve-sealed', 'a light tap preserves the packet instead of opening it');

  let hold = beginPacketIntent(createPacketIntentState(), 0.5, 0.5);
  for (let frame = 0; frame < 25; frame += 1) {
    hold = stepPacketIntent(hold, 1 / 60, 0.5, 0.5, config);
  }
  assert(hold.decision === 'undecided', 'the seal does not open before the authored hold threshold');
  hold = stepPacketIntent(hold, 1 / 60, 0.5, 0.5, config);
  assert(hold.decision === 'open-seal', 'a deliberate steady hold opens the seal on threshold');

  let drag = beginPacketIntent(createPacketIntentState(), 0.5, 0.5);
  drag = stepPacketIntent(drag, 0.2, 0.56, 0.5, config);
  drag = stepPacketIntent(drag, 1, 0.56, 0.5, config);
  drag = endPacketIntent(drag, config);
  assert(drag.decision === 'undecided', 'dragging off the seal cancels instead of choosing for the player');
  assert(drag.canceledByMotion, 'motion cancellation is surfaced for UI feedback');

  let released = beginPacketIntent(createPacketIntentState(), 0.5, 0.5);
  released = stepPacketIntent(released, 0.25, 0.5, 0.5, config);
  released = endPacketIntent(released, config);
  assert(released.decision === 'undecided', 'a medium release is neither accidental preserve nor accidental open');

  const snapshot = snapshotPacketIntent(hold, config);
  assert(snapshot.progress === 1, 'opened packet reports full hold progress');
};

export const runPacketIntentFeelChecks = (): void => {
  checkPacketIntentFeel();
};
