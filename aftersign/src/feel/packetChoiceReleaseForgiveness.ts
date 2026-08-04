import {
  DEFAULT_PACKET_CHOICE_FEEL,
  isPacketChoiceCommitted,
  packetChoiceFrameCostMs,
  startPacketChoiceIntent,
  stepPacketChoiceIntent,
  type PacketChoiceAction,
  type PacketChoiceFeelConfig,
  type PacketChoiceIntent,
  type PacketChoicePointer,
  type PacketChoiceStepInput,
} from '../packetChoiceFeel'

export type PacketChoiceReleaseForgivenessConfig = PacketChoiceFeelConfig & {
  /** A release on the commit-eligible frame should still land; stale releases cancel. */
  releaseGraceMs: number
}

export const DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS: PacketChoiceReleaseForgivenessConfig = {
  ...DEFAULT_PACKET_CHOICE_FEEL,
  releaseGraceMs: 50,
}

export type PacketChoiceReleaseStepInput = PacketChoiceStepInput & {
  /** Last frame where the pointer was still pressed; required to distinguish a clean release from a stale one. */
  releasedAtMs?: number
}

export function stepPacketChoiceIntentWithReleaseForgiveness(
  intent: PacketChoiceIntent,
  input: PacketChoiceReleaseStepInput,
  config: PacketChoiceReleaseForgivenessConfig = DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS,
): PacketChoiceIntent {
  if (input.pressed || intent.phase === 'committed' || intent.phase === 'cancelled') {
    return stepPacketChoiceIntent(intent, input, config)
  }

  const releaseAgeMs = input.releasedAtMs === undefined ? 0 : Math.max(0, input.nowMs - input.releasedAtMs)
  if (releaseAgeMs > config.releaseGraceMs) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  const movedPx = distance(intent.startPointer, input.pointer)
  if (movedPx > config.cancelRadiusPx) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  const inspectedSeal = intent.inspectedSeal || input.inspectedSeal === true
  const requiredHoldMs = intent.action === 'open' ? config.openHoldMs : config.preserveConfirmMs
  const elapsedMs = input.nowMs - intent.startedAtMs
  if (elapsedMs < requiredHoldMs || (intent.action === 'open' && !inspectedSeal)) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  const armedAtMs = intent.armedAtMs ?? (input.nowMs - config.minArmedVisibleMs)
  const forgivingInput: PacketChoiceStepInput = {
    ...input,
    pressed: true,
    inspectedSeal,
  }

  return stepPacketChoiceIntent(
    {
      ...intent,
      phase: 'armed',
      armedAtMs,
      inspectedSeal,
    },
    forgivingInput,
    config,
  )
}

export function startPacketChoiceReleaseIntent(
  action: PacketChoiceAction,
  nowMs: number,
  pointer: PacketChoicePointer,
  inspectedSeal = false,
): PacketChoiceIntent {
  return startPacketChoiceIntent(action, nowMs, pointer, inspectedSeal)
}

function distance(a: PacketChoicePointer, b: PacketChoicePointer): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

function assertPacketChoiceRelease(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

export function checkPacketChoiceReleaseForgiveness(
  config: PacketChoiceReleaseForgivenessConfig = DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS,
): void {
  const origin = { x: 120, y: 320 }

  let openIntent = startPacketChoiceReleaseIntent('open', 0, origin, true)
  openIntent = stepPacketChoiceIntentWithReleaseForgiveness(openIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    releasedAtMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(
    isPacketChoiceCommitted(openIntent, 'open'),
    'release on the first open commit frame is forgiven',
  )

  let preserveIntent = startPacketChoiceReleaseIntent('preserve', 0, origin)
  preserveIntent = stepPacketChoiceIntentWithReleaseForgiveness(preserveIntent, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    releasedAtMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(
    isPacketChoiceCommitted(preserveIntent, 'preserve'),
    'release on the first preserve commit frame is forgiven',
  )

  let uninspectedOpen = startPacketChoiceReleaseIntent('open', 0, origin)
  uninspectedOpen = stepPacketChoiceIntentWithReleaseForgiveness(uninspectedOpen, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    releasedAtMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
    inspectedSeal: false,
  }, config)
  assertPacketChoiceRelease(
    uninspectedOpen.phase === 'cancelled',
    'open release forgiveness cannot bypass seal inspection',
  )

  let staleRelease = startPacketChoiceReleaseIntent('preserve', 0, origin)
  staleRelease = stepPacketChoiceIntentWithReleaseForgiveness(staleRelease, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs + config.releaseGraceMs + 1,
    releasedAtMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(staleRelease.phase === 'cancelled', 'stale packet-choice releases still cancel')

  let dragAway = startPacketChoiceReleaseIntent('preserve', 0, origin)
  dragAway = stepPacketChoiceIntentWithReleaseForgiveness(dragAway, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    releasedAtMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    pointer: { x: origin.x + config.cancelRadiusPx + 1, y: origin.y },
    pressed: false,
  }, config)
  assertPacketChoiceRelease(dragAway.phase === 'cancelled', 'drag-away cancellation wins over release forgiveness')

  const measuredCost = packetChoiceFrameCostMs(6, 9.2)
  assertPacketChoiceRelease(
    measuredCost <= config.frameBudgetMs,
    'packet release-forgiveness bookkeeping stays inside a 60Hz frame budget',
  )
}

export function runPacketChoiceReleaseForgivenessChecks(): void {
  checkPacketChoiceReleaseForgiveness()
}
