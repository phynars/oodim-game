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
  /** Finger-up events that land on the first commit-eligible frame should still count as the intended choice. */
  releaseGraceMs: number
}

export const DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS: PacketChoiceReleaseForgivenessConfig = {
  ...DEFAULT_PACKET_CHOICE_FEEL,
  releaseGraceMs: DEFAULT_PACKET_CHOICE_FEEL.frameBudgetMs,
}

export function stepPacketChoiceIntentWithReleaseForgiveness(
  intent: PacketChoiceIntent,
  input: PacketChoiceStepInput,
  config: PacketChoiceReleaseForgivenessConfig = DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS,
): PacketChoiceIntent {
  if (intent.phase === 'committed' || intent.phase === 'cancelled') return intent
  if (input.pressed) return stepPacketChoiceIntent(intent, input, config)

  const inspectedSeal = intent.inspectedSeal || input.inspectedSeal === true
  const movedPx = distance(intent.startPointer, input.pointer)
  if (movedPx > config.cancelRadiusPx) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  const commitEligibleAtMs = packetChoiceCommitEligibleAtMs(intent, inspectedSeal, config)
  const releaseLagMs = commitEligibleAtMs === null ? Number.POSITIVE_INFINITY : input.nowMs - commitEligibleAtMs
  const releaseCanCommit = releaseLagMs >= 0 && releaseLagMs <= config.releaseGraceMs

  if (releaseCanCommit) {
    return {
      ...intent,
      phase: 'committed',
      armedAtMs: intent.armedAtMs,
      committedAtMs: input.nowMs,
      lastPointer: { ...input.pointer },
      inspectedSeal,
    }
  }

  return stepPacketChoiceIntent(intent, input, config)
}

export function packetChoiceCommitEligibleAtMs(
  intent: PacketChoiceIntent,
  inspectedSeal: boolean,
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
): number | null {
  if (intent.armedAtMs === null) return null
  if (intent.action === 'open' && !inspectedSeal) return null
  return intent.armedAtMs + config.minArmedVisibleMs
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

  let openIntent = startPacketChoiceIntent('open', 0, origin, true)
  openIntent = stepPacketChoiceIntentWithReleaseForgiveness(openIntent, {
    nowMs: config.openHoldMs,
    pointer: origin,
    pressed: true,
  }, config)
  openIntent = stepPacketChoiceIntentWithReleaseForgiveness(openIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(isPacketChoiceCommitted(openIntent, 'open'), 'opening release on the first commit-eligible frame still commits')

  let blockedOpenIntent = startPacketChoiceIntent('open', 0, origin, false)
  blockedOpenIntent = stepPacketChoiceIntentWithReleaseForgiveness(blockedOpenIntent, {
    nowMs: config.openHoldMs,
    pointer: origin,
    pressed: true,
    inspectedSeal: false,
  }, config)
  blockedOpenIntent = stepPacketChoiceIntentWithReleaseForgiveness(blockedOpenIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
    inspectedSeal: false,
  }, config)
  assertPacketChoiceRelease(blockedOpenIntent.phase === 'cancelled', 'opening release forgiveness does not bypass seal inspection')

  let preserveIntent = startPacketChoiceIntent('preserve', 0, origin)
  preserveIntent = stepPacketChoiceIntentWithReleaseForgiveness(preserveIntent, {
    nowMs: config.preserveConfirmMs,
    pointer: origin,
    pressed: true,
  }, config)
  preserveIntent = stepPacketChoiceIntentWithReleaseForgiveness(preserveIntent, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(isPacketChoiceCommitted(preserveIntent, 'preserve'), 'preserve release on the first commit-eligible frame still commits')

  let staleReleaseIntent = startPacketChoiceIntent('preserve', 0, origin)
  staleReleaseIntent = stepPacketChoiceIntentWithReleaseForgiveness(staleReleaseIntent, {
    nowMs: config.preserveConfirmMs,
    pointer: origin,
    pressed: true,
  }, config)
  staleReleaseIntent = stepPacketChoiceIntentWithReleaseForgiveness(staleReleaseIntent, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs + config.releaseGraceMs + 1,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(staleReleaseIntent.phase === 'cancelled', 'stale releases after the forgiveness window still cancel')

  let dragAwayIntent = startPacketChoiceIntent('open', 0, origin, true)
  dragAwayIntent = stepPacketChoiceIntentWithReleaseForgiveness(dragAwayIntent, {
    nowMs: config.openHoldMs,
    pointer: origin,
    pressed: true,
  }, config)
  dragAwayIntent = stepPacketChoiceIntentWithReleaseForgiveness(dragAwayIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: { x: origin.x + config.cancelRadiusPx + 1, y: origin.y },
    pressed: false,
  }, config)
  assertPacketChoiceRelease(dragAwayIntent.phase === 'cancelled', 'drag-away cancellation wins over release forgiveness')

  const measuredCost = packetChoiceFrameCostMs(4, 7.5)
  assertPacketChoiceRelease(measuredCost <= config.frameBudgetMs, 'release-forgiveness bookkeeping stays inside a 60Hz frame budget')
}

export function runPacketChoiceReleaseForgivenessChecks(): void {
  checkPacketChoiceReleaseForgiveness()
}

export function buildPacketChoiceReleaseForgivenessTrace(action: PacketChoiceAction): PacketChoiceIntent {
  const origin = { x: 120, y: 320 }
  const started = startPacketChoiceIntent(action, 0, origin, action === 'open')
  const config = DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS
  const armed = stepPacketChoiceIntentWithReleaseForgiveness(started, {
    nowMs: action === 'open' ? config.openHoldMs : config.preserveConfirmMs,
    pointer: origin,
    pressed: true,
  }, config)
  return stepPacketChoiceIntentWithReleaseForgiveness(armed, {
    nowMs: (action === 'open' ? config.openHoldMs : config.preserveConfirmMs) + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
}
