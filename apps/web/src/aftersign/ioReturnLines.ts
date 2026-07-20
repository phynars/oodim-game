export type IoPacketOutcome = 'sealed' | 'opened'

export type IoRouteListening = 'listened' | 'skipped'

export interface IoReturnMemoryInput {
  readonly packetOutcome?: IoPacketOutcome
  readonly routeListening?: IoRouteListening
  readonly hasReturned?: boolean
}

export interface IoReturnLine {
  readonly id: string
  readonly text: string
  readonly remembered: readonly string[]
}

const SEALED_PACKET_LINE: IoReturnLine = {
  id: 'io-return-packet-sealed',
  text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  remembered: ['returned', 'packet-sealed'],
}

const OPENED_PACKET_LINE: IoReturnLine = {
  id: 'io-return-packet-opened',
  text: 'You came back. The seal did not. I can use one of those facts.',
  remembered: ['returned', 'packet-opened'],
}

const LISTENED_LINE: IoReturnLine = {
  id: 'io-return-route-listened',
  text: 'You listened before you ran. Rare habit. Keep it.',
  remembered: ['route-listened'],
}

const SKIPPED_LINE: IoReturnLine = {
  id: 'io-return-route-skipped',
  text: 'You found the box anyway. Next time, let me finish saving your life.',
  remembered: ['route-skipped'],
}

const FIRST_RETURN_LINE: IoReturnLine = {
  id: 'io-return-first',
  text: 'Back already. Good. Vey trusts repeatable things.',
  remembered: ['returned'],
}

export function getIoReturnLine(memory: IoReturnMemoryInput): IoReturnLine {
  if (memory.packetOutcome === 'sealed') {
    return SEALED_PACKET_LINE
  }

  if (memory.packetOutcome === 'opened') {
    return OPENED_PACKET_LINE
  }

  if (memory.routeListening === 'listened') {
    return LISTENED_LINE
  }

  if (memory.routeListening === 'skipped') {
    return SKIPPED_LINE
  }

  return FIRST_RETURN_LINE
}

export const ioReturnLines = {
  sealedPacket: SEALED_PACKET_LINE,
  openedPacket: OPENED_PACKET_LINE,
  listened: LISTENED_LINE,
  skipped: SKIPPED_LINE,
  firstReturn: FIRST_RETURN_LINE,
} as const
