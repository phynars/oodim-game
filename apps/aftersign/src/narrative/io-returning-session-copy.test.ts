import { describe, expect, it } from 'vitest'

import { getIoReturningSessionLine, ioReturningSessionLines } from './io-returning-session-copy'

describe('getIoReturningSessionLine', () => {
  it('prefers concrete packet outcome memory over all other return facts', () => {
    expect(
      getIoReturningSessionLine({
        packetOutcome: 'sealed',
        listenedToRoute: false,
        returnTone: 'blunt',
      }),
    ).toEqual(ioReturningSessionLines.packetOutcome.sealed)
  })

  it('gives Io distinct audited lines for sealed and opened packet returns', () => {
    expect(getIoReturningSessionLine({ packetOutcome: 'sealed' })).toMatchObject({
      id: 'io.return.packet.sealed',
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      remembers: ['returned-after-close', 'packet-delivered-sealed'],
    })

    expect(getIoReturningSessionLine({ packetOutcome: 'opened' })).toMatchObject({
      id: 'io.return.packet.opened',
      text: 'You came back. The seal did not. I can use one of those facts.',
      remembers: ['returned-after-close', 'packet-opened'],
    })
  })

  it('falls back to route behavior when the packet outcome is not yet stored', () => {
    expect(getIoReturningSessionLine({ listenedToRoute: true })).toMatchObject({
      id: 'io.return.route.listened',
      remembers: ['route-instructions-heard'],
    })

    expect(getIoReturningSessionLine({ listenedToRoute: false })).toMatchObject({
      id: 'io.return.route.skipped',
      remembers: ['route-instructions-skipped'],
    })
  })

  it('keeps return-tone lines short and tied to one remembered answer', () => {
    expect(getIoReturningSessionLine({ returnTone: 'kind' })).toMatchObject({
      id: 'io.return.tone.kind',
      remembers: ['return-answer-kind'],
    })

    expect(getIoReturningSessionLine({ returnTone: 'evasive' })).toMatchObject({
      id: 'io.return.tone.evasive',
      remembers: ['return-answer-evasive'],
    })

    expect(getIoReturningSessionLine({ returnTone: 'blunt' })).toMatchObject({
      id: 'io.return.tone.blunt',
      remembers: ['return-answer-blunt'],
    })
  })

  it('has a first-return line for players who only proved they came back', () => {
    expect(getIoReturningSessionLine({ returnedAfterClose: true })).toEqual(ioReturningSessionLines.firstReturn)
  })
})
