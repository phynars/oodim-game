export type PacketIntentMode = 'idle' | 'inspecting' | 'opening' | 'opened';

export interface PacketIntentState {
  mode: PacketIntentMode;
  sealed: boolean;
  holdMs: number;
  cue: 'none' | 'inspect' | 'commit' | 'opened' | 'cancel';
}

export interface PacketIntentInput {
  inspecting: boolean;
  holdingOpen: boolean;
  deltaMs: number;
}

export const PACKET_OPEN_HOLD_MS = 420;

export function createPacketIntentState(): PacketIntentState {
  return {
    mode: 'idle',
    sealed: true,
    holdMs: 0,
    cue: 'none',
  };
}

export function getPacketOpenProgress(state: PacketIntentState): number {
  if (!state.sealed) return 1;
  return Math.min(1, Math.max(0, state.holdMs / PACKET_OPEN_HOLD_MS));
}

export function updatePacketIntent(
  state: PacketIntentState,
  input: PacketIntentInput,
): PacketIntentState {
  if (!state.sealed) {
    return { ...state, mode: 'opened', holdMs: PACKET_OPEN_HOLD_MS, cue: 'opened' };
  }

  if (!input.inspecting) {
    return {
      mode: 'idle',
      sealed: true,
      holdMs: 0,
      cue: state.holdMs > 0 ? 'cancel' : 'none',
    };
  }

  if (!input.holdingOpen) {
    return {
      mode: 'inspecting',
      sealed: true,
      holdMs: 0,
      cue: state.holdMs > 0 ? 'cancel' : 'inspect',
    };
  }

  const holdMs = Math.max(0, state.holdMs + Math.max(0, input.deltaMs));
  if (holdMs >= PACKET_OPEN_HOLD_MS) {
    return {
      mode: 'opened',
      sealed: false,
      holdMs: PACKET_OPEN_HOLD_MS,
      cue: 'opened',
    };
  }

  return {
    mode: 'opening',
    sealed: true,
    holdMs,
    cue: 'commit',
  };
}

function assertPacketIntent(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`packetIntent: ${message}`);
  }
}

export function checkInspectOnlyKeepsPacketSealed(): void {
  const state = updatePacketIntent(createPacketIntentState(), {
    inspecting: true,
    holdingOpen: false,
    deltaMs: 1000,
  });

  assertPacketIntent(state.sealed, 'inspect-only interaction must keep packet sealed');
  assertPacketIntent(state.mode === 'inspecting', 'inspect-only interaction should stay in inspecting mode');
  assertPacketIntent(getPacketOpenProgress(state) === 0, 'inspect-only interaction should not build open progress');
}

export function checkHoldThresholdOpensPacket(): void {
  let state = createPacketIntentState();
  state = updatePacketIntent(state, { inspecting: true, holdingOpen: true, deltaMs: 419 });
  assertPacketIntent(state.sealed, 'packet opened before the deliberate hold threshold');
  assertPacketIntent(getPacketOpenProgress(state) < 1, 'pre-threshold hold reported complete progress');

  state = updatePacketIntent(state, { inspecting: true, holdingOpen: true, deltaMs: 1 });
  assertPacketIntent(!state.sealed, 'packet did not open at the deliberate hold threshold');
  assertPacketIntent(state.mode === 'opened', 'packet should enter opened mode at threshold');
  assertPacketIntent(getPacketOpenProgress(state) === 1, 'opened packet should report complete progress');
}

export function checkReleaseCancelsPartialOpen(): void {
  let state = createPacketIntentState();
  state = updatePacketIntent(state, { inspecting: true, holdingOpen: true, deltaMs: 200 });
  state = updatePacketIntent(state, { inspecting: true, holdingOpen: false, deltaMs: 16 });

  assertPacketIntent(state.sealed, 'release before threshold must keep packet sealed');
  assertPacketIntent(state.mode === 'inspecting', 'release while inspecting should return to inspecting mode');
  assertPacketIntent(state.holdMs === 0, 'release before threshold should clear partial hold time');
  assertPacketIntent(state.cue === 'cancel', 'release before threshold should emit a cancel cue');
}

export function checkBackgroundFrameCannotOpenPacket(): void {
  let state = createPacketIntentState();
  state = updatePacketIntent(state, { inspecting: false, holdingOpen: true, deltaMs: 10_000 });

  assertPacketIntent(state.sealed, 'background frame opened packet without inspection focus');
  assertPacketIntent(state.mode === 'idle', 'background frame should leave packet idle');
  assertPacketIntent(state.holdMs === 0, 'background frame should not accumulate hold time');
}

export function runPacketIntentChecks(): void {
  checkInspectOnlyKeepsPacketSealed();
  checkHoldThresholdOpensPacket();
  checkReleaseCancelsPartialOpen();
  checkBackgroundFrameCannotOpenPacket();
}
