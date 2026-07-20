import {
  chooseIoReturningSessionLine,
  getIoReturningSessionLine,
  ioReturningSessionLines,
  type IoReturningSessionLineKey,
} from './ioReturningSession'

// These strings are pinned to docs/flagship/vertical-slice-script.md §7–§8.
// If a beat needs to move, amend the script in the same PR — do not fork
// the words here.
const expectedLines: Record<IoReturningSessionLineKey, string> = {
  sealedPacket:
    'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  openedPacket: 'You came back. The seal did not. I can use one of those facts.',
  sealedPacketListenedRoute:
    'You came back with the blue seal unbroken, and you listened before you ran. That gives me two good facts and no excuses.',
  sealedPacketSkippedRoute:
    'You came back with the blue seal unbroken, and you still ran before the route finished. Reliable hands, impatient feet.',
  openedPacketListenedRoute:
    'You came back with a broken seal, but you listened before you ran. One clean habit is still a habit.',
  openedPacketSkippedRoute:
    'You came back with a broken seal and half my route. That is not ideal, but it is enough to route.',
  listenedRoute: 'You listened before you ran. Rare habit. Keep it.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  kindReturn:
    'Careful. Say that too often and people will start handing you breakable things.',
  evasiveReturn: 'Work is a clean word. We can use it until it stains.',
  bluntReturn: 'Good. Wanting is easier to route than pretending.',
}

describe('ioReturningSessionLines', () => {
  it('pins every authored returning-session line to the script', () => {
    expect(ioReturningSessionLines).toEqual(expectedLines)
  })

  it.each(Object.entries(expectedLines) as [IoReturningSessionLineKey, string][])(
    'returns the %s line by key',
    (key, expectedLine) => {
      expect(getIoReturningSessionLine(key)).toBe(expectedLine)
    },
  )

  it('prioritizes the chained packet+route pair over single-signal lines', () => {
    // When both packet outcome and route attention are remembered, the
    // chained pair line wins over any single-signal fallback.
    expect(
      chooseIoReturningSessionLine({
        packetOutcome: 'sealed',
        routeAttention: 'listened',
        returnAnswerTone: 'blunt',
      }),
    ).toBe(expectedLines.sealedPacketListenedRoute)

    expect(
      chooseIoReturningSessionLine({
        packetOutcome: 'sealed',
        routeAttention: 'skipped',
        returnAnswerTone: 'blunt',
      }),
    ).toBe(expectedLines.sealedPacketSkippedRoute)

    expect(
      chooseIoReturningSessionLine({
        packetOutcome: 'opened',
        routeAttention: 'listened',
        returnAnswerTone: 'kind',
      }),
    ).toBe(expectedLines.openedPacketListenedRoute)

    expect(
      chooseIoReturningSessionLine({
        packetOutcome: 'opened',
        routeAttention: 'skipped',
        returnAnswerTone: 'kind',
      }),
    ).toBe(expectedLines.openedPacketSkippedRoute)
  })

  it('falls through to single-signal packet outcome when only packet is known', () => {
    expect(chooseIoReturningSessionLine({ packetOutcome: 'sealed' })).toBe(
      expectedLines.sealedPacket,
    )
    expect(chooseIoReturningSessionLine({ packetOutcome: 'opened' })).toBe(
      expectedLines.openedPacket,
    )
  })

  it('falls through to route attention, then answer tone', () => {
    expect(chooseIoReturningSessionLine({ routeAttention: 'skipped' })).toBe(
      expectedLines.skippedRoute,
    )
    expect(chooseIoReturningSessionLine({ routeAttention: 'listened' })).toBe(
      expectedLines.listenedRoute,
    )
    expect(chooseIoReturningSessionLine({ returnAnswerTone: 'kind' })).toBe(
      expectedLines.kindReturn,
    )
    expect(chooseIoReturningSessionLine({ returnAnswerTone: 'evasive' })).toBe(
      expectedLines.evasiveReturn,
    )
    expect(chooseIoReturningSessionLine({ returnAnswerTone: 'blunt' })).toBe(
      expectedLines.bluntReturn,
    )
  })

  it('defaults empty memory to the listened-route line', () => {
    expect(chooseIoReturningSessionLine({})).toBe(expectedLines.listenedRoute)
  })
})
