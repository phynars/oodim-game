export type PacketSealState = 'sealed' | 'opened';
export type PacketIntentPhase = 'idle' | 'charging' | 'opened' | 'false-sealed';

export interface PacketIntentState {
  phase: PacketIntentPhase;
  seal: PacketSealState;
  heldMs: number;
  lastReleaseMs: number | null;
  canRecover: boolean;
}

export interface PacketIntentSnapshot extends PacketIntentState {
  progress: number;
  instruction: string;
}

export const PACKET_OPEN_HOLD_MS = 450;

export function createPacketIntentState(): PacketIntentState {
  return {
    phase: 'idle',
    seal: 'sealed',
    heldMs: 0,
    lastReleaseMs: null,
    canRecover: false,
  };
}

export function pressPacket(state: PacketIntentState): PacketIntentState {
  if (state.seal === 'opened') {
    return { ...state, phase: 'opened', heldMs: PACKET_OPEN_HOLD_MS, canRecover: false };
  }

  return {
    ...state,
    phase: 'charging',
    canRecover: false,
  };
}

export function holdPacket(state: PacketIntentState, deltaMs: number): PacketIntentState {
  if (state.phase !== 'charging' || state.seal === 'opened') {
    return state;
  }

  const heldMs = Math.max(0, state.heldMs + deltaMs);
  if (heldMs >= PACKET_OPEN_HOLD_MS) {
    return {
      ...state,
      phase: 'opened',
      seal: 'opened',
      heldMs: PACKET_OPEN_HOLD_MS,
      lastReleaseMs: null,
      canRecover: false,
    };
  }

  return {
    ...state,
    heldMs,
  };
}

export function releasePacket(state: PacketIntentState): PacketIntentState {
  if (state.seal === 'opened') {
    return { ...state, phase: 'opened', heldMs: PACKET_OPEN_HOLD_MS, canRecover: false };
  }

  if (state.phase !== 'charging') {
    return state;
  }

  if (state.heldMs <= 0) {
    return {
      ...state,
      phase: 'idle',
      lastReleaseMs: 0,
      canRecover: false,
    };
  }

  return {
    ...state,
    phase: 'false-sealed',
    lastReleaseMs: state.heldMs,
    canRecover: true,
  };
}

export function snapshotPacketIntent(state: PacketIntentState): PacketIntentSnapshot {
  const progress = state.seal === 'opened' ? 1 : Math.min(1, state.heldMs / PACKET_OPEN_HOLD_MS);
  const instruction = state.seal === 'opened'
    ? 'Seal broken.'
    : state.phase === 'charging'
      ? 'Hold to break the seal.'
      : state.canRecover
        ? 'Seal held. Press again to finish opening.'
        : 'Press and hold only if you mean to open it.';

  return {
    ...state,
    progress,
    instruction,
  };
}

function assertPacket(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkTapDoesNotOpenPacket(): void {
  const state = releasePacket(pressPacket(createPacketIntentState()));
  assertPacket(state.seal === 'sealed', 'tap must not break the packet seal');
  assertPacket(state.phase === 'idle', 'zero-duration release should return to idle, not false-sealed');
  assertPacket(state.canRecover === false, 'zero-duration tap should not show recovery affordance');
}

export function checkIntentionalHoldOpensPacket(): void {
  const state = holdPacket(pressPacket(createPacketIntentState()), PACKET_OPEN_HOLD_MS);
  assertPacket(state.seal === 'opened', '450ms hold must open the packet');
  assertPacket(state.phase === 'opened', 'opened packet must report opened phase');
  assertPacket(snapshotPacketIntent(state).progress === 1, 'opened packet progress must clamp to 1');
}

export function checkRecoverableFalseSealedCanOpen(): void {
  const nearMiss = releasePacket(holdPacket(pressPacket(createPacketIntentState()), PACKET_OPEN_HOLD_MS - 1));
  assertPacket(nearMiss.seal === 'sealed', '449ms near-miss must preserve the seal');
  assertPacket(nearMiss.phase === 'false-sealed', '449ms near-miss should become false-sealed feedback');
  assertPacket(nearMiss.canRecover === true, '449ms near-miss must remain recoverable');

  const recovered = holdPacket(pressPacket(nearMiss), 1);
  assertPacket(recovered.seal === 'opened', 'recovering with the final 1ms hold must open the packet');
}

export function runPacketIntentChecks(): void {
  checkTapDoesNotOpenPacket();
  checkIntentionalHoldOpensPacket();
  checkRecoverableFalseSealedCanOpen();
}
