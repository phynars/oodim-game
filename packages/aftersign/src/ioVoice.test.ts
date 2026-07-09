import { describe, expect, it } from 'vitest'

import { selectIoRecognitionLine } from './ioVoice'

describe('selectIoRecognitionLine', () => {
  it('references a sealed packet memory', () => {
    expect(selectIoRecognitionLine({ packetOutcome: 'sealed' })).toEqual({
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      referencedFact: 'packetOutcome',
      referencedValue: 'sealed',
    })
  })

  it('references an opened packet memory', () => {
    expect(selectIoRecognitionLine({ packetOutcome: 'opened' })).toEqual({
      text: 'You came back. The seal did not. I can use one of those facts.',
      referencedFact: 'packetOutcome',
      referencedValue: 'opened',
    })
  })

  it('references route attention when no packet outcome is present', () => {
    expect(selectIoRecognitionLine({ routeAttention: 'listened' })).toEqual({
      text: 'You listened before you ran. Rare habit. Keep it.',
      referencedFact: 'routeAttention',
      referencedValue: 'listened',
    })

    expect(selectIoRecognitionLine({ routeAttention: 'skipped' })).toEqual({
      text: 'You found the box anyway. Next time, let me finish saving your life.',
      referencedFact: 'routeAttention',
      referencedValue: 'skipped',
    })
  })

  it('references return tone when no higher-priority memory is present', () => {
    expect(selectIoRecognitionLine({ returnTone: 'kind' })).toEqual({
      text: 'Kind answer. Not cheaper than truth, but sometimes easier to carry.',
      referencedFact: 'returnTone',
      referencedValue: 'kind',
    })

    expect(selectIoRecognitionLine({ returnTone: 'evasive' })).toEqual({
      text: 'You dodged the question. Fine. Vey keeps receipts for both of us.',
      referencedFact: 'returnTone',
      referencedValue: 'evasive',
    })

    expect(selectIoRecognitionLine({ returnTone: 'blunt' })).toEqual({
      text: 'Blunt, then. Good. Wrapped knives still cut.',
      referencedFact: 'returnTone',
      referencedValue: 'blunt',
    })
  })
})
