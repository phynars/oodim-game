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

  it('prioritizes remembered packet outcome over route and answer tone', () => {
    expect(
      chooseIoReturningSessionLine({
        packetOutcome: 'sealed',
        routeAttention: 'skipped',
        returnAnswerTone: 'blunt',
      }),
    ).toBe(expectedLines.sealedPacket)

    expect(
      chooseIoReturningSessionLine({
        packetOutcome: 'opened',
        routeAttention: 'listened',
        returnAnswerTone: 'kind',
      }),
    ).toBe(expectedLines.openedPacket)
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
