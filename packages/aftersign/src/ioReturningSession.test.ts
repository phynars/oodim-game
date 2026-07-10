import {
  chooseIoReturningSessionLine,
  getIoReturningSessionLine,
  ioReturningSessionLines,
  type IoReturningSessionLineKey,
} from './ioReturningSession'

const expectedLines: Record<IoReturningSessionLineKey, string> = {
  sealedPacket:
    'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  openedPacket: 'You came back. The seal did not. I can use one of those facts.',
  listenedRoute: 'You listened before you ran. Rare habit. Keep it.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  kindReturn: 'Kind answer. Dangerous tool. Keep it sharp.',
  evasiveReturn: 'You walked around the question. I noticed the shape of the path.',
  bluntReturn: 'Blunt, then. Fine. A dull knife still opens rope.',
  fallback: 'Back again. Good. Vey is less cruel to repeat witnesses.',
}

describe('ioReturningSessionLines', () => {
  it('pins every authored returning-session line', () => {
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

  it('falls through to route attention, answer tone, then fallback', () => {
    expect(chooseIoReturningSessionLine({ routeAttention: 'listened' })).toBe(
      expectedLines.listenedRoute,
    )
    expect(chooseIoReturningSessionLine({ routeAttention: 'skipped' })).toBe(
      expectedLines.skippedRoute,
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
    expect(chooseIoReturningSessionLine({})).toBe(expectedLines.fallback)
  })
})
