export type PacketSealState = 'sealed' | 'opened'
export type PacketIntentCue = 'idle' | 'inspect-held' | 'hold-to-open' | 'release-cancel' | 'opened'

export interface PacketIntentState {
  sealState: PacketSealState
  cue: PacketIntentCue
  holdMs: number
  openedAtMs: number | null
}

export interface PacketIntentInput {
  inspecting: boolean
  primaryHeld: boolean
  dtMs: number
}

export const PACKET_OPEN_HOLD_MS = 420

export function createPacketIntentState(): PacketIntentState {
  return {
    sealState: 'sealed',
    cue: 'idle',
    holdMs: 0,
    openedAtMs: null,
  }
}

export function updatePacketIntent(
  state: PacketIntentState,
  input: PacketIntentInput,
): PacketIntentState {
  if (state.sealState === 'opened') {
    return {
      ...state,
      cue: 'opened',
      holdMs: PACKET_OPEN_HOLD_MS,
    }
  }

  if (!input.inspecting) {
    return {
      ...state,
      cue: 'idle',
      holdMs: 0,
    }
  }

  if (!input.primaryHeld) {
    return {
      ...state,
      cue: state.holdMs > 0 ? 'release-cancel' : 'inspect-held',
      holdMs: 0,
    }
  }

  const nextHoldMs = Math.min(PACKET_OPEN_HOLD_MS, state.holdMs + Math.max(0, input.dtMs))

  if (nextHoldMs >= PACKET_OPEN_HOLD_MS) {
    return {
      sealState: 'opened',
      cue: 'opened',
      holdMs: PACKET_OPEN_HOLD_MS,
      openedAtMs: state.openedAtMs ?? PACKET_OPEN_HOLD_MS,
    }
  }

  return {
    ...state,
    cue: 'hold-to-open',
    holdMs: nextHoldMs,
  }
}

export function getPacketOpenProgress(state: PacketIntentState): number {
  return state.sealState === 'opened' ? 1 : state.holdMs / PACKET_OPEN_HOLD_MS
}
