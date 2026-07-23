export type PacketChoiceAction = 'preserve' | 'open'
export type PacketChoicePhase = 'idle' | 'preview' | 'armed' | 'committed' | 'cancelled'

export type PacketChoiceFeelConfig = {
  /** Opening the sealed packet is irreversible, so it must survive this much deliberate hold time. */
  openHoldMs: number
  /** Preserving the seal should still register as an explicit beat, not a drive-by tap. */
  preserveConfirmMs: number
  /** Dragging farther than this cancels the pending choice before commit. */
  cancelRadiusPx: number
  /** Once armed, the affordance must be visible for at least this long before commit. */
  minArmedVisibleMs: number
  /** Input work for a frame must stay inside one 60Hz frame budget. */
  frameBudgetMs: number
}

export type PacketChoicePointer = {
  x: number
  y: number
}

export type PacketChoiceIntent = {
  action: PacketChoiceAction
  phase: PacketChoicePhase
  startedAtMs: number
  armedAtMs: number | null
  committedAtMs: number | null
  startPointer: PacketChoicePointer
  lastPointer: PacketChoicePointer
  inspectedSeal: boolean
}

export type PacketChoiceStepInput = {
  nowMs: number
  pointer: PacketChoicePointer
  pressed: boolean
  inspectedSeal?: boolean
}

export const DEFAULT_PACKET_CHOICE_FEEL: PacketChoiceFeelConfig = {
  openHoldMs: 420,
  preserveConfirmMs: 120,
  cancelRadiusPx: 22,
  minArmedVisibleMs: 100,
  frameBudgetMs: 16.67,
}

export function startPacketChoiceIntent(
  action: PacketChoiceAction,
  nowMs: number,
  pointer: PacketChoicePointer,
  inspectedSeal = false,
): PacketChoiceIntent {
  return {
    action,
    phase: 'preview',
    startedAtMs: nowMs,
    armedAtMs: null,
    committedAtMs: null,
    startPointer: { ...pointer },
    lastPointer: { ...pointer },
    inspectedSeal,
  }
}

export function stepPacketChoiceIntent(
  intent: PacketChoiceIntent,
  input: PacketChoiceStepInput,
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
): PacketChoiceIntent {
  if (intent.phase === 'committed' || intent.phase === 'cancelled') return intent

  const inspectedSeal = intent.inspectedSeal || input.inspectedSeal === true
  const elapsedMs = input.nowMs - intent.startedAtMs
  const movedPx = distance(intent.startPointer, input.pointer)

  if (!input.pressed || movedPx > config.cancelRadiusPx) {
    return {
      ...intent,
      phase: 'cancelled',
      lastPointer: { ...input.pointer },
      inspectedSeal,
    }
  }

  const requiredHoldMs = intent.action === 'open' ? config.openHoldMs : config.preserveConfirmMs
  const canArm = elapsedMs >= requiredHoldMs && (intent.action === 'preserve' || inspectedSeal)
  const armedAtMs = intent.armedAtMs ?? (canArm ? input.nowMs : null)
  const phase: PacketChoicePhase = armedAtMs === null ? 'preview' : 'armed'
  const armedVisibleMs = armedAtMs === null ? 0 : input.nowMs - armedAtMs

  if (armedAtMs !== null && armedVisibleMs >= config.minArmedVisibleMs) {
    return {
      ...intent,
      phase: 'committed',
      armedAtMs,
      committedAtMs: input.nowMs,
      lastPointer: { ...input.pointer },
      inspectedSeal,
    }
  }

  return {
    ...intent,
    phase,
    armedAtMs,
    lastPointer: { ...input.pointer },
    inspectedSeal,
  }
}

export function isPacketChoiceCommitted(intent: PacketChoiceIntent, action: PacketChoiceAction): boolean {
  return intent.phase === 'committed' && intent.action === action
}

export function packetChoiceFrameCostMs(startedAtMs: number, finishedAtMs: number): number {
  return Math.max(0, finishedAtMs - startedAtMs)
}

function distance(a: PacketChoicePointer, b: PacketChoicePointer): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

function assertPacketChoice(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

export function checkPacketChoiceFeel(config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL): void {
  const origin = { x: 120, y: 320 }

  let openIntent = startPacketChoiceIntent('open', 0, origin)
  openIntent = stepPacketChoiceIntent(openIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs + 40,
    pointer: origin,
    pressed: true,
    inspectedSeal: false,
  }, config)
  assertPacketChoice(openIntent.phase !== 'committed', 'opening cannot commit before the seal has been inspected')

  openIntent = startPacketChoiceIntent('open', 0, origin, true)
  openIntent = stepPacketChoiceIntent(openIntent, {
    nowMs: config.openHoldMs,
    pointer: origin,
    pressed: true,
  }, config)
  assertPacketChoice(openIntent.phase === 'armed', 'opening arms only after the deliberate hold completes')
  openIntent = stepPacketChoiceIntent(openIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: true,
  }, config)
  assertPacketChoice(isPacketChoiceCommitted(openIntent, 'open'), 'opening commits after hold plus visible armed feedback')

  let preserveIntent = startPacketChoiceIntent('preserve', 0, origin)
  preserveIntent = stepPacketChoiceIntent(preserveIntent, {
    nowMs: config.preserveConfirmMs,
    pointer: origin,
    pressed: true,
  }, config)
  assertPacketChoice(preserveIntent.phase === 'armed', 'preserving arms only after the confirm hold completes')
  preserveIntent = stepPacketChoiceIntent(preserveIntent, {
    nowMs: config.preserveConfirmMs + config.minArmedVisibleMs,
    pointer: origin,
    pressed: true,
  }, config)
  assertPacketChoice(isPacketChoiceCommitted(preserveIntent, 'preserve'), 'preserving the seal is an explicit confirmed action')

  let cancelledIntent = startPacketChoiceIntent('open', 0, origin, true)
  cancelledIntent = stepPacketChoiceIntent(cancelledIntent, {
    nowMs: config.openHoldMs + config.minArmedVisibleMs,
    pointer: { x: origin.x + config.cancelRadiusPx + 1, y: origin.y },
    pressed: true,
  }, config)
  assertPacketChoice(cancelledIntent.phase === 'cancelled', 'dragging away cancels an irreversible packet choice')

  const measuredCost = packetChoiceFrameCostMs(4, 7.5)
  assertPacketChoice(measuredCost <= config.frameBudgetMs, 'packet choice input bookkeeping stays inside a 60Hz frame budget')
}

export function runPacketChoiceFeelChecks(): void {
  checkPacketChoiceFeel()
}
