export type PacketIntentChoice = 'sealed' | 'opened'
export type PacketIntentPhase = 'idle' | 'pressing' | 'committed' | 'cancelled'

export interface PacketIntentConfig {
  /** Minimum hold time before opening the packet is accepted. */
  openHoldMs: number
  /** Maximum pointer drift before the hold cancels, tuned for thumb jitter. */
  cancelRadiusPx: number
  /** Smallest progress value that should show UI feedback. */
  visibleProgressFloor: number
}

export interface PacketIntentState {
  phase: PacketIntentPhase
  choice: PacketIntentChoice
  startedAtMs: number | null
  pointerId: number | null
  originX: number
  originY: number
  progress: number
}

export interface PacketIntentSnapshot extends PacketIntentState {
  canCommitOpen: boolean
  shouldShowFeedback: boolean
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 620,
  cancelRadiusPx: 34,
  visibleProgressFloor: 0.08,
}

export const PACKET_INTENT_HARNESS_CONTRACT = {
  sealedTapMaxMs: 180,
  openHoldMs: DEFAULT_PACKET_INTENT_CONFIG.openHoldMs,
  cancelRadiusPx: DEFAULT_PACKET_INTENT_CONFIG.cancelRadiusPx,
} as const

export function createPacketIntentState(choice: PacketIntentChoice = 'sealed'): PacketIntentState {
  return {
    phase: 'idle',
    choice,
    startedAtMs: null,
    pointerId: null,
    originX: 0,
    originY: 0,
    progress: 0,
  }
}

export function beginPacketOpenIntent(
  state: PacketIntentState,
  pointerId: number,
  x: number,
  y: number,
  nowMs: number,
): PacketIntentState {
  if (state.phase === 'committed') return state

  return {
    ...state,
    phase: 'pressing',
    startedAtMs: nowMs,
    pointerId,
    originX: x,
    originY: y,
    progress: 0,
  }
}

export function updatePacketOpenIntent(
  state: PacketIntentState,
  pointerId: number,
  x: number,
  y: number,
  nowMs: number,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  if (state.phase !== 'pressing' || state.pointerId !== pointerId || state.startedAtMs === null) {
    return state
  }

  const drift = Math.hypot(x - state.originX, y - state.originY)
  if (drift > config.cancelRadiusPx) {
    return {
      ...state,
      phase: 'cancelled',
      pointerId: null,
      startedAtMs: null,
      progress: 0,
    }
  }

  const heldMs = Math.max(0, nowMs - state.startedAtMs)
  const progress = clamp01(heldMs / config.openHoldMs)

  if (progress >= 1) {
    return {
      ...state,
      phase: 'committed',
      choice: 'opened',
      pointerId: null,
      startedAtMs: null,
      progress: 1,
    }
  }

  return {
    ...state,
    progress,
  }
}

export function endPacketOpenIntent(
  state: PacketIntentState,
  pointerId: number,
): PacketIntentState {
  if (state.phase !== 'pressing' || state.pointerId !== pointerId) return state

  return {
    ...state,
    phase: 'idle',
    pointerId: null,
    startedAtMs: null,
    progress: 0,
  }
}

export function keepPacketSealed(state: PacketIntentState): PacketIntentState {
  if (state.phase === 'committed') return state

  return {
    ...state,
    phase: 'committed',
    choice: 'sealed',
    pointerId: null,
    startedAtMs: null,
    progress: 0,
  }
}

export function snapshotPacketIntent(
  state: PacketIntentState,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentSnapshot {
  return {
    ...state,
    canCommitOpen: state.phase === 'pressing' && state.progress >= 1,
    shouldShowFeedback: state.phase === 'pressing' && state.progress >= config.visibleProgressFloor,
  }
}

function clamp01(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}
