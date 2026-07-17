export type PacketSealState = 'sealed' | 'opened';
export type PacketCueState = 'idle' | 'inspect' | 'opening' | 'opened';

export interface PacketIntentState {
  seal: PacketSealState;
  cue: PacketCueState;
  inspectMs: number;
  holdMs: number;
  isInspecting: boolean;
  isHoldingOpen: boolean;
}

export interface PacketIntentInput {
  inspect?: boolean;
  holdOpen?: boolean;
  dtMs?: number;
}

export const PACKET_OPEN_HOLD_MS = 420;

export function createPacketIntentState(): PacketIntentState {
  return {
    seal: 'sealed',
    cue: 'idle',
    inspectMs: 0,
    holdMs: 0,
    isInspecting: false,
    isHoldingOpen: false,
  };
}

export function packetOpenProgress(state: PacketIntentState): number {
  if (state.seal === 'opened') return 1;
  return Math.max(0, Math.min(1, state.holdMs / PACKET_OPEN_HOLD_MS));
}

export function updatePacketIntent(
  state: PacketIntentState,
  input: PacketIntentInput,
): PacketIntentState {
  if (state.seal === 'opened') {
    return {
      ...state,
      cue: 'opened',
      holdMs: PACKET_OPEN_HOLD_MS,
      isInspecting: Boolean(input.inspect),
      isHoldingOpen: false,
    };
  }

  const dtMs = Math.max(0, input.dtMs ?? 0);
  const isInspecting = Boolean(input.inspect);
  const isHoldingOpen = isInspecting && Boolean(input.holdOpen);
  const inspectMs = isInspecting ? state.inspectMs + dtMs : 0;
  const holdMs = isHoldingOpen ? state.holdMs + dtMs : 0;

  if (holdMs >= PACKET_OPEN_HOLD_MS) {
    return {
      seal: 'opened',
      cue: 'opened',
      inspectMs,
      holdMs: PACKET_OPEN_HOLD_MS,
      isInspecting,
      isHoldingOpen: false,
    };
  }

  return {
    seal: 'sealed',
    cue: isHoldingOpen ? 'opening' : isInspecting ? 'inspect' : 'idle',
    inspectMs,
    holdMs,
    isInspecting,
    isHoldingOpen,
  };
}

function assertPacketIntent(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`packetIntent: ${message}`);
  }
}

export function checkInspectOnlyDoesNotOpen(): void {
  let state = createPacketIntentState();

  for (let frame = 0; frame < 90; frame += 1) {
    state = updatePacketIntent(state, { inspect: true, holdOpen: false, dtMs: 16 });
  }

  assertPacketIntent(state.seal === 'sealed', 'inspect-only interaction must preserve the seal');
  assertPacketIntent(state.cue === 'inspect', 'inspect-only interaction should stay in inspect cue');
  assertPacketIntent(packetOpenProgress(state) === 0, 'inspect-only interaction must not build open progress');
}

export function checkDeliberateHoldOpensAtThreshold(): void {
  let state = createPacketIntentState();

  state = updatePacketIntent(state, { inspect: true, holdOpen: true, dtMs: PACKET_OPEN_HOLD_MS - 1 });
  assertPacketIntent(state.seal === 'sealed', 'packet opened before the deliberate hold threshold');
  assertPacketIntent(state.cue === 'opening', 'pre-threshold hold should show opening cue');
  assertPacketIntent(packetOpenProgress(state) < 1, 'pre-threshold hold should report partial progress');

  state = updatePacketIntent(state, { inspect: true, holdOpen: true, dtMs: 1 });
  assertPacketIntent(state.seal === 'opened', 'packet did not open at the deliberate hold threshold');
  assertPacketIntent(state.cue === 'opened', 'opened packet should expose opened cue');
  assertPacketIntent(packetOpenProgress(state) === 1, 'opened packet should report full progress');
}

export function checkReleaseCancelsPartialHold(): void {
  let state = createPacketIntentState();

  state = updatePacketIntent(state, { inspect: true, holdOpen: true, dtMs: PACKET_OPEN_HOLD_MS / 2 });
  assertPacketIntent(state.cue === 'opening', 'initial hold should enter opening cue');
  assertPacketIntent(packetOpenProgress(state) > 0, 'initial hold should build progress');

  state = updatePacketIntent(state, { inspect: true, holdOpen: false, dtMs: 16 });
  assertPacketIntent(state.seal === 'sealed', 'release before threshold must keep the seal intact');
  assertPacketIntent(state.cue === 'inspect', 'release while inspecting should return to inspect cue');
  assertPacketIntent(state.holdMs === 0, 'release before threshold should cancel held progress');
}

export function checkBackgroundFrameCannotOpenPacket(): void {
  let state = createPacketIntentState();

  state = updatePacketIntent(state, { inspect: false, holdOpen: true, dtMs: 10_000 });

  assertPacketIntent(state.seal === 'sealed', 'background frame opened packet without inspection focus');
  assertPacketIntent(state.cue === 'idle', 'background frame should remain idle');
  assertPacketIntent(state.holdMs === 0, 'background frame must not accumulate hold progress');
}

export function runPacketIntentChecks(): void {
  checkInspectOnlyDoesNotOpen();
  checkDeliberateHoldOpensAtThreshold();
  checkReleaseCancelsPartialHold();
  checkBackgroundFrameCannotOpenPacket();
}
