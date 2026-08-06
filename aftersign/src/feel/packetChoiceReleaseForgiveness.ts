import {
  DEFAULT_PACKET_CHOICE_FEEL,
  stepPacketChoiceIntent,
} from '../packetChoiceFeel'
import type {
  PacketChoiceFeelConfig,
  PacketChoiceIntent,
  PacketChoiceStepInput,
} from '../packetChoiceFeel'

export type PacketChoiceReleaseForgivenessConfig = PacketChoiceFeelConfig & {
  /** A release that lands on the first commit-eligible frame should still count as the intended choice. */
  releaseGraceMs: number
}

export const DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS: PacketChoiceReleaseForgivenessConfig = {
  ...DEFAULT_PACKET_CHOICE_FEEL,
  releaseGraceMs: 50,
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
    return {
      ...intent,
      phase: 'cancelled',
      lastPointer: { ...input.pointer },
      inspectedSeal,
    }
  }

  const requiredHoldMs = intent.action === 'open' ? config.openHoldMs : config.preserveConfirmMs
  const elapsedMs = input.nowMs - intent.startedAtMs
  const commitEligibleAtMs = requiredHoldMs + config.minArmedVisibleMs
  const releaseLateByMs = elapsedMs - commitEligibleAtMs
  const canReleaseCommit =
    elapsedMs >= commitEligibleAtMs &&
    releaseLateByMs <= config.releaseGraceMs &&
    (intent.action === 'preserve' || inspectedSeal)

  if (!canReleaseCommit) {
    return {
      ...intent,
      phase: 'cancelled',
      lastPointer: { ...input.pointer },
      inspectedSeal,
    }
  }

  const armedAtMs = intent.armedAtMs ?? intent.startedAtMs + requiredHoldMs
  return {
    ...intent,
    phase: 'committed',
    armedAtMs,
    committedAtMs: input.nowMs,
    lastPointer: { ...input.pointer },
    inspectedSeal,
  }
}

export function packetChoiceReleaseBookkeepingCostMs(startedAtMs: number, finishedAtMs: number): number {
  return Math.max(0, finishedAtMs - startedAtMs)
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
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

  let preserveIntent = {
    action: 'preserve' as const,
    phase: 'preview' as const,
    startedAtMs: 0,
    armedAtMs: null,
    committedAtMs: null,
    startPointer: origin,
    lastPointer: origin,
    inspectedSeal: false,
  }
  preserveIntent = stepPacketChoiceIntentWithReleaseForgiveness(preserveIntent, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(preserveIntent.phase === 'committed', 'release on the first preserve commit frame still commits preserve')
  assertPacketChoiceRelease(preserveIntent.committedAtMs === config.preserveConfirmMs + config.minArmedVisibleMs, 'preserve release commit keeps the release timestamp')

  let openIntent = {
    action: 'open' as const,
    phase: 'preview' as const,
    startedAtMs: 0,
    armedAtMs: null,
    committedAtMs: null,
    startPointer: origin,
    lastPointer: origin,
    inspectedSeal: true,
  }
  openIntent = stepPacketChoiceIntentWithReleaseForgiveness(openIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(openIntent.phase === 'committed', 'release on the first open commit frame still commits open')

  let uninspectedOpenIntent = {
    action: 'open' as const,
    phase: 'preview' as const,
    startedAtMs: 0,
    armedAtMs: null,
    committedAtMs: null,
    startPointer: origin,
    lastPointer: origin,
    inspectedSeal: false,
  }
  uninspectedOpenIntent = stepPacketChoiceIntentWithReleaseForgiveness(uninspectedOpenIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: false,
    inspectedSeal: false,
  }, config)
  assertPacketChoiceRelease(uninspectedOpenIntent.phase === 'cancelled', 'open release forgiveness cannot bypass seal inspection')

  let staleReleaseIntent = {
    action: 'preserve' as const,
    phase: 'preview' as const,
    startedAtMs: 0,
    armedAtMs: null,
    committedAtMs: null,
    startPointer: origin,
    lastPointer: origin,
    inspectedSeal: false,
  }
  staleReleaseIntent = stepPacketChoiceIntentWithReleaseForgiveness(staleReleaseIntent, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs + config.releaseGraceMs + 1,
    pointer: origin,
    pressed: false,
  }, config)
  assertPacketChoiceRelease(staleReleaseIntent.phase === 'cancelled', 'stale releases outside grace cancel instead of committing late')

  let draggedReleaseIntent = {
    action: 'preserve' as const,
    phase: 'preview' as const,
    startedAtMs: 0,
    armedAtMs: null,
    committedAtMs: null,
    startPointer: origin,
    lastPointer: origin,
    inspectedSeal: false,
  }
  draggedReleaseIntent = stepPacketChoiceIntentWithReleaseForgiveness(draggedReleaseIntent, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    pointer: { x: origin.x + config.cancelRadiusPx + 1, y: origin.y },
    pressed: false,
  }, config)
  assertPacketChoiceRelease(draggedReleaseIntent.phase === 'cancelled', 'drag-away cancellation wins over release forgiveness')

  const measuredCost = packetChoiceReleaseBookkeepingCostMs(4, 7.5)
  assertPacketChoiceRelease(measuredCost <= config.frameBudgetMs, 'release forgiveness bookkeeping stays inside a 60Hz frame budget')
}

export function runPacketChoiceReleaseForgivenessChecks(): void {
  checkPacketChoiceReleaseForgiveness()
}
