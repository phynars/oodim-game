export type PacketSealState = 'sealed' | 'opened'
export type PacketIntentAction = 'press-start' | 'press-cancel' | 'release' | 'tick'
export type PacketIntentOutcome = 'pending' | 'kept-sealed' | 'opened'

export interface PacketIntentConfig {
  /** Hold duration, in milliseconds, required before opening becomes deliberate. */
  openHoldMs: number
  /** A fast cancel must be allowed so a thumb-down mistake does not break the seal. */
  cancelWindowMs: number
  /** Distance, in normalized control units, the thumb may drift before the hold is treated as cancelled. */
  driftCancelDistance: number
}

export interface PacketIntentState {
  seal: PacketSealState
  outcome: PacketIntentOutcome
  holdStartedAtMs: number | null
  elapsedMs: number
  armedToOpen: boolean
  cancelled: boolean
  lastReason: string
}

export interface PacketIntentInput {
  action: PacketIntentAction
  nowMs: number
  driftDistance?: number
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 650,
  cancelWindowMs: 180,
  driftCancelDistance: 0.32,
}

export function createPacketIntentState(seal: PacketSealState = 'sealed'): PacketIntentState {
  return {
    seal,
    outcome: seal === 'opened' ? 'opened' : 'pending',
    holdStartedAtMs: null,
    elapsedMs: 0,
    armedToOpen: false,
    cancelled: false,
    lastReason: seal === 'opened' ? 'already-opened' : 'waiting',
  }
}

export function reducePacketIntent(
  state: PacketIntentState,
  input: PacketIntentInput,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentState {
  if (state.outcome !== 'pending') return { ...state, lastReason: 'resolved' }
  if (state.seal === 'opened') return { ...state, outcome: 'opened', lastReason: 'already-opened' }

  if (input.action === 'press-cancel') {
    return {
      ...state,
      holdStartedAtMs: null,
      elapsedMs: 0,
      armedToOpen: false,
      cancelled: true,
      lastReason: 'cancelled-by-player',
    }
  }

  if (input.action === 'press-start') {
    return {
      ...state,
      holdStartedAtMs: input.nowMs,
      elapsedMs: 0,
      armedToOpen: false,
      cancelled: false,
      lastReason: 'hold-started',
    }
  }

  if (state.holdStartedAtMs === null) {
    return { ...state, lastReason: 'no-active-hold' }
  }

  const elapsedMs = Math.max(0, input.nowMs - state.holdStartedAtMs)
  const driftDistance = input.driftDistance ?? 0

  if (driftDistance > config.driftCancelDistance) {
    return {
      ...state,
      holdStartedAtMs: null,
      elapsedMs,
      armedToOpen: false,
      cancelled: true,
      lastReason: 'cancelled-by-drift',
    }
  }

  if (input.action === 'release') {
    if (elapsedMs < config.cancelWindowMs) {
      return {
        ...state,
        holdStartedAtMs: null,
        elapsedMs,
        armedToOpen: false,
        cancelled: true,
        lastReason: 'tap-forgiven',
      }
    }

    if (elapsedMs < config.openHoldMs) {
      return {
        ...state,
        holdStartedAtMs: null,
        elapsedMs,
        armedToOpen: false,
        cancelled: true,
        lastReason: 'released-before-commit',
      }
    }

    return {
      ...state,
      seal: 'opened',
      outcome: 'opened',
      holdStartedAtMs: null,
      elapsedMs,
      armedToOpen: true,
      cancelled: false,
      lastReason: 'opened-deliberately',
    }
  }

  return {
    ...state,
    elapsedMs,
    armedToOpen: elapsedMs >= config.openHoldMs,
    lastReason: elapsedMs >= config.openHoldMs ? 'open-armed' : 'holding',
  }
}

export function keepPacketSealed(state: PacketIntentState): PacketIntentState {
  if (state.seal === 'opened') return { ...state, outcome: 'opened', lastReason: 'already-opened' }
  return {
    ...state,
    outcome: 'kept-sealed',
    holdStartedAtMs: null,
    elapsedMs: 0,
    armedToOpen: false,
    cancelled: false,
    lastReason: 'kept-sealed-by-player',
  }
}

function assertPacketIntent(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`packet intent check failed: ${message}`)
}

export function checkPacketFastTapForgiven(): void {
  const started = reducePacketIntent(createPacketIntentState(), { action: 'press-start', nowMs: 1_000 })
  const released = reducePacketIntent(started, { action: 'release', nowMs: 1_090 })

  assertPacketIntent(released.outcome === 'pending', 'fast tap must not open or keep the packet')
  assertPacketIntent(released.seal === 'sealed', 'fast tap must leave the seal intact')
  assertPacketIntent(released.cancelled, 'fast tap should be treated as an intentional forgiveness path')
  assertPacketIntent(released.lastReason === 'tap-forgiven', 'fast tap should report tap-forgiven')
}

export function checkPacketHoldRequiresCommit(): void {
  const started = reducePacketIntent(createPacketIntentState(), { action: 'press-start', nowMs: 2_000 })
  const holding = reducePacketIntent(started, { action: 'tick', nowMs: 2_649 })
  const released = reducePacketIntent(holding, { action: 'release', nowMs: 2_649 })

  assertPacketIntent(!holding.armedToOpen, 'hold should not arm before the commit threshold')
  assertPacketIntent(released.outcome === 'pending', 'release before commit must not open the packet')
  assertPacketIntent(released.seal === 'sealed', 'release before commit must preserve the seal')
  assertPacketIntent(released.lastReason === 'released-before-commit', 'short hold should report released-before-commit')
}

export function checkPacketLongHoldOpens(): void {
  const started = reducePacketIntent(createPacketIntentState(), { action: 'press-start', nowMs: 3_000 })
  const armed = reducePacketIntent(started, { action: 'tick', nowMs: 3_650 })
  const released = reducePacketIntent(armed, { action: 'release', nowMs: 3_650 })

  assertPacketIntent(armed.armedToOpen, 'hold should visibly arm at the commit threshold')
  assertPacketIntent(released.outcome === 'opened', 'committed release must open the packet')
  assertPacketIntent(released.seal === 'opened', 'committed release must change seal state')
  assertPacketIntent(released.lastReason === 'opened-deliberately', 'committed release should report opened-deliberately')
}

export function checkPacketDriftCancels(): void {
  const started = reducePacketIntent(createPacketIntentState(), { action: 'press-start', nowMs: 4_000 })
  const drifted = reducePacketIntent(started, { action: 'tick', nowMs: 4_400, driftDistance: 0.5 })

  assertPacketIntent(drifted.outcome === 'pending', 'drift cancel should not resolve the packet choice')
  assertPacketIntent(drifted.seal === 'sealed', 'drift cancel should preserve the seal')
  assertPacketIntent(drifted.cancelled, 'drift beyond the radius should cancel the hold')
  assertPacketIntent(drifted.lastReason === 'cancelled-by-drift', 'drift cancel should report cancelled-by-drift')
}

export function checkPacketKeepSealedIsExplicit(): void {
  const kept = keepPacketSealed(createPacketIntentState())

  assertPacketIntent(kept.outcome === 'kept-sealed', 'keeping the packet sealed must be an explicit outcome')
  assertPacketIntent(kept.seal === 'sealed', 'keeping the packet sealed must preserve the seal')
  assertPacketIntent(kept.lastReason === 'kept-sealed-by-player', 'kept path should report kept-sealed-by-player')
}

export function runPacketIntentChecks(): void {
  checkPacketFastTapForgiven()
  checkPacketHoldRequiresCommit()
  checkPacketLongHoldOpens()
  checkPacketDriftCancels()
  checkPacketKeepSealedIsExplicit()
}
