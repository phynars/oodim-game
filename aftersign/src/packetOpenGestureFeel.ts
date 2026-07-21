export type PacketGestureDecision = 'pending' | 'preserve' | 'open' | 'cancelled'

export type PacketGestureSample = {
  /** Elapsed hold time in milliseconds since the player started pressing the packet seal. */
  elapsedMs: number
  /** Pointer travel from the gesture origin, in CSS pixels. */
  travelPx: number
  /** True only when the player is still holding the packet seal. */
  pressed: boolean
  /** True when the pointer/finger is still inside the seal hit target. */
  insideHitTarget: boolean
}

export type PacketOpenGestureOptions = {
  /** Minimum committed hold time for opening the blue seal. */
  openHoldMs?: number
  /** Short taps below this time preserve the packet instead of opening it. */
  preserveTapMs?: number
  /** Movement beyond this distance cancels the high-stakes packet choice. */
  cancelTravelPx?: number
}

export type PacketOpenGestureSnapshot = {
  decision: PacketGestureDecision
  progress: number
  elapsedMs: number
  travelPx: number
}

const DEFAULT_OPEN_HOLD_MS = 620
const DEFAULT_PRESERVE_TAP_MS = 180
const DEFAULT_CANCEL_TRAVEL_PX = 18

export function evaluatePacketOpenGesture(
  sample: PacketGestureSample,
  options: PacketOpenGestureOptions = {},
): PacketOpenGestureSnapshot {
  const openHoldMs = options.openHoldMs ?? DEFAULT_OPEN_HOLD_MS
  const preserveTapMs = options.preserveTapMs ?? DEFAULT_PRESERVE_TAP_MS
  const cancelTravelPx = options.cancelTravelPx ?? DEFAULT_CANCEL_TRAVEL_PX
  const elapsedMs = Math.max(0, sample.elapsedMs)
  const travelPx = Math.max(0, sample.travelPx)
  const progress = Math.min(1, elapsedMs / openHoldMs)

  if (!sample.insideHitTarget || travelPx > cancelTravelPx) {
    return { decision: 'cancelled', progress, elapsedMs, travelPx }
  }

  if (sample.pressed && elapsedMs >= openHoldMs) {
    return { decision: 'open', progress: 1, elapsedMs, travelPx }
  }

  if (!sample.pressed && elapsedMs <= preserveTapMs) {
    return { decision: 'preserve', progress, elapsedMs, travelPx }
  }

  if (!sample.pressed) {
    return { decision: 'cancelled', progress, elapsedMs, travelPx }
  }

  return { decision: 'pending', progress, elapsedMs, travelPx }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function checkPacketOpenRequiresDeliberateHold(): void {
  const tap = evaluatePacketOpenGesture({ elapsedMs: 120, travelPx: 2, pressed: false, insideHitTarget: true })
  assert(tap.decision === 'preserve', `short release should preserve packet, got ${tap.decision}`)

  const almost = evaluatePacketOpenGesture({ elapsedMs: 610, travelPx: 4, pressed: true, insideHitTarget: true })
  assert(almost.decision === 'pending', `hold before threshold should stay pending, got ${almost.decision}`)

  const committed = evaluatePacketOpenGesture({ elapsedMs: 620, travelPx: 4, pressed: true, insideHitTarget: true })
  assert(committed.decision === 'open', `threshold hold should open packet, got ${committed.decision}`)
}

export function checkPacketOpenCancelsOnFidgetOrMiss(): void {
  const fidget = evaluatePacketOpenGesture({ elapsedMs: 640, travelPx: 24, pressed: true, insideHitTarget: true })
  assert(fidget.decision === 'cancelled', `dragging during hold should cancel packet choice, got ${fidget.decision}`)

  const missed = evaluatePacketOpenGesture({ elapsedMs: 640, travelPx: 4, pressed: true, insideHitTarget: false })
  assert(missed.decision === 'cancelled', `leaving seal hit target should cancel packet choice, got ${missed.decision}`)
}

export function runPacketOpenGestureFeelChecks(): void {
  checkPacketOpenRequiresDeliberateHold()
  checkPacketOpenCancelsOnFidgetOrMiss()
}
