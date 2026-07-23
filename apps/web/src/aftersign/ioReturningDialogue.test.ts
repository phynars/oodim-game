import { describe, expect, it } from 'vitest'
import {
  chooseAftersignIoReturningLine,
  getAftersignIoReturningLines,
  type AftersignIoMemory,
} from './ioReturningDialogue'

describe('chooseAftersignIoReturningLine', () => {
  it('returns the sealed-packet recognition line when Io remembers an unbroken seal', () => {
    expect(chooseAftersignIoReturningLine({ packetOutcome: 'sealed', returnedAfterClose: true })).toEqual({
      id: 'io.returning.packet.sealed',
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      references: ['player.returned', 'packet.delivered_sealed'],
    })
  })

  it('returns the opened-packet recognition line when Io remembers a broken seal', () => {
    expect(chooseAftersignIoReturningLine({ packetOutcome: 'opened', returnedAfterClose: true })).toEqual({
      id: 'io.returning.packet.opened',
      text: 'You came back. The seal did not. I can use one of those facts.',
      references: ['player.returned', 'packet.opened'],
    })
  })

  it('returns the route-skip line only when packet outcome is not more specific', () => {
    expect(chooseAftersignIoReturningLine({ routeAttention: 'skipped' })).toEqual({
      id: 'io.returning.route.skipped',
      text: 'You found the box anyway. Next time, let me finish saving your life.',
      references: ['route.skipped'],
    })

    expect(chooseAftersignIoReturningLine({ packetOutcome: 'sealed', routeAttention: 'skipped' }).id).toBe(
      'io.returning.packet.sealed',
    )
  })

  it('returns the route-listened line only when packet outcome is not more specific', () => {
    expect(chooseAftersignIoReturningLine({ routeAttention: 'listened' })).toEqual({
      id: 'io.returning.route.listened',
      text: 'You listened before you ran. Rare habit. Keep it.',
      references: ['route.listened'],
    })
  })

  it('does not invent remembered facts when no authored memory exists', () => {
    expect(chooseAftersignIoReturningLine({})).toEqual({
      id: 'io.returning.fallback',
      text: 'Back again. Good. Vey wastes fewer facts on the familiar.',
      references: [],
    })
  })

  it('keeps every authored line tied to auditable memory references', () => {
    const memoriesByLineId: Record<string, AftersignIoMemory> = {
      'io.returning.packet.sealed': { packetOutcome: 'sealed', returnedAfterClose: true },
      'io.returning.packet.opened': { packetOutcome: 'opened', returnedAfterClose: true },
      'io.returning.route.skipped': { routeAttention: 'skipped' },
      'io.returning.route.listened': { routeAttention: 'listened' },
      'io.returning.fallback': {},
    }

    for (const line of getAftersignIoReturningLines()) {
      const memory = memoriesByLineId[line.id]
      expect(memory).toBeDefined()
      expect(chooseAftersignIoReturningLine(memory)).toEqual(line)
    }
  })
})
