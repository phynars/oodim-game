export type PacketSealState = 'sealed' | 'opening' | 'opened'
export type PacketIntentDecision = 'none' | 'preserve' | 'open'

export interface PacketIntentConfig {
  /** Hold duration, in milliseconds, required to break the blue seal. */
  openHoldMs: number
  /** Release before this duration preserves the packet instead of opening it. */
  preserveReleaseMs: number
}

export interface PacketIntentState {
  seal: PacketSealState
  decision: PacketIntentDecision
  holdMs: number
  progress: number
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 650,
  preserveReleaseMs: 180,
}

export function createPacketIntentState(): PacketIntentState {
  return {
    seal: 'sealed',
    decision: 'none',
    holdMs: 0,
    progress: 0,
  }
}

export function beginPacketIntent(state: PacketIntentState): PacketIntentState {
  if (state.seal === 'opened') return state

  return {
    seal: 'opening',
    decision: 'none',
    holdMs: 0,
    progress: 0,
  }
}

export function updatePacketIntent(
  state: PacketIntentState,
  deltaMs: number,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  if (state.seal !== 'opening') return state

  const holdMs = Math.max(0, state.holdMs + Math.max(0, deltaMs))
  const progress = clamp01(holdMs / config.openHoldMs)

  if (holdMs >= config.openHoldMs) {
    return {
      seal: 'opened',
      decision: 'open',
      holdMs,
      progress: 1,
    }
  }

  return {
    seal: 'opening',
    decision: 'none',
    holdMs,
    progress,
  }
}

export function releasePacketIntent(
  state: PacketIntentState,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  if (state.seal === 'opened') return state

  if (state.seal !== 'opening') {
    return {
      ...state,
      decision: 'none',
      holdMs: 0,
      progress: 0,
    }
  }

  const decision: PacketIntentDecision = state.holdMs < config.preserveReleaseMs ? 'preserve' : 'none'

  return {
    seal: 'sealed',
    decision,
    holdMs: 0,
    progress: 0,
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
