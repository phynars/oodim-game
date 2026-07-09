export type IoPacketOutcome = 'sealed' | 'opened'
export type IoRouteAttention = 'listened' | 'skipped'
export type IoReturnTone = 'kind' | 'evasive' | 'blunt'

export type IoMemoryFact =
  | {
      kind: 'packetOutcome'
      value: IoPacketOutcome
    }
  | {
      kind: 'routeAttention'
      value: IoRouteAttention
    }
  | {
      kind: 'returnTone'
      value: IoReturnTone
    }

export interface IoRememberedLine {
  speaker: 'Io Vale'
  text: string
  referencedFact: IoMemoryFact['kind']
  referencedValue: IoMemoryFact['value']
}

export interface IoRecognitionMemory {
  packetOutcome?: IoPacketOutcome
  routeAttention?: IoRouteAttention
  returnTone?: IoReturnTone
}

const PACKET_LINES: Record<IoPacketOutcome, IoRememberedLine> = {
  sealed: {
    speaker: 'Io Vale',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    referencedFact: 'packetOutcome',
    referencedValue: 'sealed',
  },
  opened: {
    speaker: 'Io Vale',
    text: 'You came back. The seal did not. I can use one of those facts.',
    referencedFact: 'packetOutcome',
    referencedValue: 'opened',
  },
}

const ROUTE_LINES: Record<IoRouteAttention, IoRememberedLine> = {
  listened: {
    speaker: 'Io Vale',
    text: 'You listened before you ran. Rare habit. Keep it.',
    referencedFact: 'routeAttention',
    referencedValue: 'listened',
  },
  skipped: {
    speaker: 'Io Vale',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    referencedFact: 'routeAttention',
    referencedValue: 'skipped',
  },
}

const RETURN_TONE_LINES: Record<IoReturnTone, IoRememberedLine> = {
  kind: {
    speaker: 'Io Vale',
    text: 'Kind answer. Not cheaper than truth, but sometimes easier to carry.',
    referencedFact: 'returnTone',
    referencedValue: 'kind',
  },
  evasive: {
    speaker: 'Io Vale',
    text: 'You dodged the question. Fine. Vey keeps receipts for both of us.',
    referencedFact: 'returnTone',
    referencedValue: 'evasive',
  },
  blunt: {
    speaker: 'Io Vale',
    text: 'Blunt, then. Good. Wrapped knives still cut.',
    referencedFact: 'returnTone',
    referencedValue: 'blunt',
  },
}

export function selectIoRecognitionLine(memory: IoRecognitionMemory): IoRememberedLine | null {
  if (memory.packetOutcome) {
    return PACKET_LINES[memory.packetOutcome]
  }

  if (memory.routeAttention) {
    return ROUTE_LINES[memory.routeAttention]
  }

  if (memory.returnTone) {
    return RETURN_TONE_LINES[memory.returnTone]
  }

  return null
}
