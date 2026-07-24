export type PacketIntentPhase = 'idle' | 'pressing' | 'preserve' | 'opening' | 'cancelled';

export interface PacketIntentConfig {
  readonly preserveTapMaxMs: number;
  readonly openHoldMs: number;
  readonly cancelDragPx: number;
}

export interface PacketIntentState {
  readonly phase: PacketIntentPhase;
  readonly pressedAtMs: number | null;
  readonly pressX: number;
  readonly pressY: number;
  readonly elapsedMs: number;
  readonly dragPx: number;
}

export interface PacketIntentSample {
  readonly state: PacketIntentState;
  readonly commit: 'none' | 'preserve' | 'open' | 'cancel';
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  preserveTapMaxMs: 180,
  openHoldMs: 420,
  cancelDragPx: 18,
};

export const createPacketIntentState = (): PacketIntentState => ({
  phase: 'idle',
  pressedAtMs: null,
  pressX: 0,
  pressY: 0,
  elapsedMs: 0,
  dragPx: 0,
});

export function pressPacketIntent(
  state: PacketIntentState,
  atMs: number,
  x: number,
  y: number,
): PacketIntentSample {
  if (state.phase === 'opening' || state.phase === 'preserve') {
    return { state, commit: 'none' };
  }

  return {
    state: {
      phase: 'pressing',
      pressedAtMs: atMs,
      pressX: x,
      pressY: y,
      elapsedMs: 0,
      dragPx: 0,
    },
    commit: 'none',
  };
}

export function movePacketIntent(
  state: PacketIntentState,
  atMs: number,
  x: number,
  y: number,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentSample {
  if (state.phase !== 'pressing' || state.pressedAtMs === null) {
    return { state, commit: 'none' };
  }

  const elapsedMs = Math.max(0, atMs - state.pressedAtMs);
  const dragPx = Math.hypot(x - state.pressX, y - state.pressY);

  if (dragPx >= config.cancelDragPx) {
    return {
      state: { ...state, phase: 'cancelled', elapsedMs, dragPx },
      commit: 'cancel',
    };
  }

  if (elapsedMs >= config.openHoldMs) {
    return {
      state: { ...state, phase: 'opening', elapsedMs, dragPx },
      commit: 'open',
    };
  }

  return {
    state: { ...state, elapsedMs, dragPx },
    commit: 'none',
  };
}

export function releasePacketIntent(
  state: PacketIntentState,
  atMs: number,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentSample {
  if (state.phase !== 'pressing' || state.pressedAtMs === null) {
    return { state, commit: 'none' };
  }

  const elapsedMs = Math.max(0, atMs - state.pressedAtMs);

  if (elapsedMs <= config.preserveTapMaxMs) {
    return {
      state: { ...state, phase: 'preserve', elapsedMs },
      commit: 'preserve',
    };
  }

  if (elapsedMs >= config.openHoldMs) {
    return {
      state: { ...state, phase: 'opening', elapsedMs },
      commit: 'open',
    };
  }

  return {
    state: { ...state, phase: 'cancelled', elapsedMs },
    commit: 'cancel',
  };
}

function assertPacketIntent(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkPacketIntentTapPreserves(): void {
  const pressed = pressPacketIntent(createPacketIntentState(), 1_000, 64, 96).state;
  const released = releasePacketIntent(pressed, 1_120);

  assertPacketIntent(released.commit === 'preserve', 'quick packet tap should preserve the sealed packet');
  assertPacketIntent(released.state.phase === 'preserve', 'quick packet tap should land in preserve phase');
}

export function checkPacketIntentHoldOpens(): void {
  const pressed = pressPacketIntent(createPacketIntentState(), 2_000, 64, 96).state;
  const moved = movePacketIntent(pressed, 2_420, 65, 97);

  assertPacketIntent(moved.commit === 'open', '420ms packet hold should intentionally open the packet');
  assertPacketIntent(moved.state.phase === 'opening', '420ms packet hold should land in opening phase');
}

export function checkPacketIntentDragCancels(): void {
  const pressed = pressPacketIntent(createPacketIntentState(), 3_000, 64, 96).state;
  const moved = movePacketIntent(pressed, 3_080, 83, 96);

  assertPacketIntent(moved.commit === 'cancel', 'dragging out of packet focus should cancel the packet choice');
  assertPacketIntent(moved.state.phase === 'cancelled', 'dragging out should land in cancelled phase');
}

export function checkPacketIntentIndecisionCancels(): void {
  const pressed = pressPacketIntent(createPacketIntentState(), 4_000, 64, 96).state;
  const released = releasePacketIntent(pressed, 4_260);

  assertPacketIntent(
    released.commit === 'cancel',
    'release between tap and hold thresholds should not accidentally preserve or open the packet',
  );
  assertPacketIntent(released.state.phase === 'cancelled', 'ambiguous release should cancel the packet choice');
}

export function runPacketIntentChecks(): void {
  checkPacketIntentTapPreserves();
  checkPacketIntentHoldOpens();
  checkPacketIntentDragCancels();
  checkPacketIntentIndecisionCancels();
}
