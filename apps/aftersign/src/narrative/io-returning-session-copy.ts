export type PacketOutcome = 'sealed' | 'opened' | 'withheld' | 'returned'

export type ReturnTone = 'kind' | 'evasive' | 'blunt'

export interface IoReturnMemory {
  packetOutcome?: PacketOutcome
  returnedAfterClose?: boolean
  listenedToRoute?: boolean
  returnTone?: ReturnTone
}

export interface IoReturnLine {
  id: string
  text: string
  remembers: readonly string[]
}

const PACKET_OUTCOME_LINES: Record<PacketOutcome, IoReturnLine> = {
  sealed: {
    id: 'io.return.packet.sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    remembers: ['returned-after-close', 'packet-delivered-sealed'],
  },
  opened: {
    id: 'io.return.packet.opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    remembers: ['returned-after-close', 'packet-opened'],
  },
  withheld: {
    id: 'io.return.packet.withheld',
    text: 'You came back with the packet still in your pocket. That is not nothing. It is not delivery.',
    remembers: ['returned-after-close', 'packet-withheld'],
  },
  returned: {
    id: 'io.return.packet.returned',
    text: 'You brought it back instead of losing it. Not clean work. Still work.',
    remembers: ['returned-after-close', 'packet-returned'],
  },
}

const ROUTE_LISTENING_LINES: Record<'listened' | 'skipped', IoReturnLine> = {
  listened: {
    id: 'io.return.route.listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    remembers: ['route-instructions-heard'],
  },
  skipped: {
    id: 'io.return.route.skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    remembers: ['route-instructions-skipped'],
  },
}

const RETURN_TONE_LINES: Record<ReturnTone, IoReturnLine> = {
  kind: {
    id: 'io.return.tone.kind',
    text: 'Kind answer. Dangerous tool. Useful one.',
    remembers: ['return-answer-kind'],
  },
  evasive: {
    id: 'io.return.tone.evasive',
    text: 'That answer walked around the question. I noticed the route.',
    remembers: ['return-answer-evasive'],
  },
  blunt: {
    id: 'io.return.tone.blunt',
    text: 'Blunt, then. Good. The rain already does subtle.',
    remembers: ['return-answer-blunt'],
  },
}

const FIRST_RETURN_LINE: IoReturnLine = {
  id: 'io.return.first',
  text: 'Back before the kettle gave up. That is either luck or character. We will invoice it later.',
  remembers: ['returned-after-close'],
}

/**
 * Selects Io's first returning-session recognition line for the vertical slice.
 * Priority stays concrete: packet outcome first, then route behavior, then answer tone.
 */
export function getIoReturningSessionLine(memory: IoReturnMemory): IoReturnLine {
  if (memory.packetOutcome) {
    return PACKET_OUTCOME_LINES[memory.packetOutcome]
  }

  if (memory.listenedToRoute !== undefined) {
    return ROUTE_LISTENING_LINES[memory.listenedToRoute ? 'listened' : 'skipped']
  }

  if (memory.returnTone) {
    return RETURN_TONE_LINES[memory.returnTone]
  }

  return FIRST_RETURN_LINE
}

export const ioReturningSessionLines = {
  firstReturn: FIRST_RETURN_LINE,
  packetOutcome: PACKET_OUTCOME_LINES,
  routeListening: ROUTE_LISTENING_LINES,
  returnTone: RETURN_TONE_LINES,
} as const
