export type PacketInspectionDecision = 'undecided' | 'preserve' | 'open'

export interface PacketInspectionIntentConfig {
  /** Minimum focused hold, in ms, required before the model commits open. */
  openHoldMs: number
  /** Movement, in CSS px, allowed before the hold is treated as a drag/cancel. */
  dragCancelPx: number
  /** Time, in ms, after which a clean tap commits preserve. */
  preserveTapMaxMs: number
}

export interface PacketInspectionPointer {
  timeMs: number
  x: number
  y: number
  pressed: boolean
  focused?: boolean
}

export interface PacketInspectionSnapshot {
  decision: PacketInspectionDecision
  holdMs: number
  preserving: boolean
  opening: boolean
  cancelledByDrag: boolean
}

interface GestureStart {
  timeMs: number
  x: number
  y: number
  hiddenMs: number
  hiddenStartMs: number | null
}

const DEFAULT_CONFIG: PacketInspectionIntentConfig = {
  openHoldMs: 520,
  dragCancelPx: 18,
  preserveTapMaxMs: 180,
}

export function createPacketInspectionIntentModel(
  config: Partial<PacketInspectionIntentConfig> = {},
) {
  const resolved: PacketInspectionIntentConfig = { ...DEFAULT_CONFIG, ...config }
  let gesture: GestureStart | null = null
  let decision: PacketInspectionDecision = 'undecided'
  let cancelledByDrag = false

  function snapshot(pointer: PacketInspectionPointer): PacketInspectionSnapshot {
    if (!gesture) {
      return {
        decision,
        holdMs: 0,
        preserving: decision === 'preserve',
        opening: decision === 'open',
        cancelledByDrag,
      }
    }

    const hiddenMs = gesture.hiddenMs + (gesture.hiddenStartMs === null ? 0 : pointer.timeMs - gesture.hiddenStartMs)
    const holdMs = Math.max(0, pointer.timeMs - gesture.timeMs - hiddenMs)

    return {
      decision,
      holdMs,
      preserving: decision === 'preserve',
      opening: decision === 'open',
      cancelledByDrag,
    }
  }

  function update(pointer: PacketInspectionPointer): PacketInspectionSnapshot {
    const focused = pointer.focused !== false

    if (!pointer.pressed) {
      if (gesture && !cancelledByDrag && decision === 'undecided') {
        const current = snapshot(pointer)
        if (current.holdMs <= resolved.preserveTapMaxMs) {
          decision = 'preserve'
        }
      }
      gesture = null
      return snapshot(pointer)
    }

    if (!gesture) {
      gesture = {
        timeMs: pointer.timeMs,
        x: pointer.x,
        y: pointer.y,
        hiddenMs: 0,
        hiddenStartMs: focused ? null : pointer.timeMs,
      }
      cancelledByDrag = false
      return snapshot(pointer)
    }

    if (!focused) {
      if (gesture.hiddenStartMs === null) {
        gesture.hiddenStartMs = pointer.timeMs
      }
      return snapshot(pointer)
    }

    if (gesture.hiddenStartMs !== null) {
      gesture.hiddenMs += pointer.timeMs - gesture.hiddenStartMs
      gesture.hiddenStartMs = null
    }

    const dx = pointer.x - gesture.x
    const dy = pointer.y - gesture.y
    if (Math.hypot(dx, dy) > resolved.dragCancelPx) {
      cancelledByDrag = true
      return snapshot(pointer)
    }

    const current = snapshot(pointer)
    if (!cancelledByDrag && decision === 'undecided' && current.holdMs >= resolved.openHoldMs) {
      decision = 'open'
    }

    return snapshot(pointer)
  }

  function reset() {
    gesture = null
    decision = 'undecided'
    cancelledByDrag = false
  }

  return { config: resolved, update, reset }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

export function checkQuickTapPreservesPacket() {
  const model = createPacketInspectionIntentModel()
  model.update({ timeMs: 0, x: 64, y: 64, pressed: true })
  const result = model.update({ timeMs: 120, x: 65, y: 64, pressed: false })

  assert(result.decision === 'preserve', 'quick tap should preserve the sealed packet')
  assert(result.preserving, 'snapshot should expose preserve state for harness assertions')
}

export function checkDeliberateHoldOpensPacket() {
  const model = createPacketInspectionIntentModel()
  model.update({ timeMs: 0, x: 64, y: 64, pressed: true })
  const before = model.update({ timeMs: 500, x: 64, y: 64, pressed: true })
  const after = model.update({ timeMs: 520, x: 64, y: 64, pressed: true })

  assert(before.decision === 'undecided', 'packet should not open before the hold threshold')
  assert(after.decision === 'open', 'packet should open exactly at the deliberate hold threshold')
  assert(after.opening, 'snapshot should expose open state for harness assertions')
}

export function checkDragCancelsPacketCommit() {
  const model = createPacketInspectionIntentModel()
  model.update({ timeMs: 0, x: 64, y: 64, pressed: true })
  const dragged = model.update({ timeMs: 560, x: 90, y: 64, pressed: true })
  const released = model.update({ timeMs: 600, x: 90, y: 64, pressed: false })

  assert(dragged.cancelledByDrag, 'movement past the cancel radius should cancel packet intent')
  assert(released.decision === 'undecided', 'dragging should not accidentally preserve or open the packet')
}

export function checkHiddenTimeDoesNotOpenPacket() {
  const model = createPacketInspectionIntentModel()
  model.update({ timeMs: 0, x: 64, y: 64, pressed: true })
  model.update({ timeMs: 200, x: 64, y: 64, pressed: true, focused: false })
  const resumed = model.update({ timeMs: 900, x: 64, y: 64, pressed: true, focused: true })
  const committed = model.update({ timeMs: 1220, x: 64, y: 64, pressed: true, focused: true })

  assert(resumed.decision === 'undecided', 'hidden tab wall-clock should not open the packet')
  assert(resumed.holdMs === 200, 'focused hold time should exclude hidden interval')
  assert(committed.decision === 'open', 'continued focused hold after resume should still open the packet')
}

export function runPacketInspectionIntentChecks() {
  checkQuickTapPreservesPacket()
  checkDeliberateHoldOpensPacket()
  checkDragCancelsPacketCommit()
  checkHiddenTimeDoesNotOpenPacket()
}
