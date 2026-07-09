import { describe, expect, it } from 'vitest'

import { selectIoRecognitionLine } from './ioVoice'

describe('selectIoRecognitionLine', () => {
  it('returns the sealed packet memory line with an auditable fact', () => {
    expect(selectIoRecognitionLine({ packetOutcome: 'sealed' })).toEqual({
      speaker: 'Io Vale',
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      referencedFact: 'packetOutcome',
      referencedValue: 'sealed',
    })
  })

  it('returns the opened packet memory line with an auditable fact', () => {
    expect(selectIoRecognitionLine({ packetOutcome: 'opened' })).toEqual({
      speaker: 'Io Vale',
      text: 'You came back. The seal did not. I can use one of those facts.',
      referencedFact: 'packetOutcome',
      referencedValue: 'opened',
    })
  })

  it('falls back to route attention when no packet outcome is recorded', () => {
    expect(selectIoRecognitionLine({ routeAttention: 'skipped' })).toEqual({
      speaker: 'Io Vale',
      text: 'You found the box anyway. Next time, let me finish saving your life.',
      referencedFact: 'routeAttention',
      referencedValue: 'skipped',
    })
  })

  it('falls back to return tone when no stronger memory is recorded', () => {
    expect(selectIoRecognitionLine({ returnTone: 'blunt' })).toEqual({
      speaker: 'Io Vale',
      text: 'Blunt, then. Good. Wrapped knives still cut.',
      referencedFact: 'returnTone',
      referencedValue: 'blunt',
    })
  })

  it('returns no line when Io has no remembered fact to cite', () => {
    expect(selectIoRecognitionLine({})).toBeNull()
  })
})
