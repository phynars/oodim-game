import { describe, expect, it } from 'vitest'

import { getIoReturnLine, ioReturnLines } from './ioReturnLines'

describe('getIoReturnLine', () => {
  it('remembers an unopened blue seal first', () => {
    expect(getIoReturnLine({ packetOutcome: 'sealed', routeListening: 'skipped' })).toEqual(
      ioReturnLines.sealedPacket,
    )
  })

  it('remembers a broken seal first', () => {
    expect(getIoReturnLine({ packetOutcome: 'opened', routeListening: 'listened' })).toEqual(
      ioReturnLines.openedPacket,
    )
  })

  it('uses route listening when packet outcome is not known', () => {
    expect(getIoReturnLine({ routeListening: 'listened' })).toEqual(ioReturnLines.listened)
    expect(getIoReturnLine({ routeListening: 'skipped' })).toEqual(ioReturnLines.skipped)
  })

  it('falls back to a return greeting without inventing a packet memory', () => {
    expect(getIoReturnLine({ hasReturned: true })).toEqual(ioReturnLines.firstReturn)
    expect(getIoReturnLine({})).toEqual(ioReturnLines.firstReturn)
  })
})
