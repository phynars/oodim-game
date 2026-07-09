export type IoPacketOutcome = 'sealed' | 'opened'
export type IoRouteAttention = 'listened' | 'skipped'
export type IoReturnTone = 'kind' | 'evasive' | 'blunt'

export type IoRecognitionMemory = {
  packetOutcome?: IoPacketOutcome
  routeAttention?: IoRouteAttention
  returnTone?: IoReturnTone
}

export type IoRecognitionLine = {
  text: string
  referencedFact: keyof IoRecognitionMemory
  referencedValue: IoPacketOutcome | IoRouteAttention | IoReturnTone
}

const PACKET_LINES: Record<IoPacketOutcome, IoRecognitionLine> = {
  sealed: {
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    referencedFact: 'packetOutcome',
    referencedValue: 'sealed',
  },
  opened: {
    text: 'You came back. The seal did not. I can use one of those facts.',
    referencedFact: 'packetOutcome',
    referencedValue: 'opened',
  },
}

const ROUTE_LINES: Record<IoRouteAttention, IoRecognitionLine> = {
  listened: {
    text: 'You listened before you ran. Rare habit. Keep it.',
    referencedFact: 'routeAttention',
    referencedValue: 'listened',
  },
  skipped: {
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    referencedFact: 'routeAttention',
    referencedValue: 'skipped',
  },
}

const TONE_LINES: Record<IoReturnTone, IoRecognitionLine> = {
  kind: {
    text: 'Kind answer. Not cheaper than truth, but sometimes easier to carry.',
    referencedFact: 'returnTone',
    referencedValue: 'kind',
  },
  evasive: {
    text: 'You dodged the question. Fine. Vey keeps receipts for both of us.',
    referencedFact: 'returnTone',
    referencedValue: 'evasive',
  },
  blunt: {
    text: 'Blunt, then. Good. Wrapped knives still cut.',
    referencedFact: 'returnTone',
    referencedValue: 'blunt',
  },
}

export function selectIoRecognitionLine(memory: IoRecognitionMemory): IoRecognitionLine {
  if (memory.packetOutcome) return PACKET_LINES[memory.packetOutcome]
  if (memory.routeAttention) return ROUTE_LINES[memory.routeAttention]
  if (memory.returnTone) return TONE_LINES[memory.returnTone]

  return {
    text: 'You came back. Good. Vey wastes fewer maps on returning hands.',
    referencedFact: 'packetOutcome',
    referencedValue: 'sealed',
  }
}
