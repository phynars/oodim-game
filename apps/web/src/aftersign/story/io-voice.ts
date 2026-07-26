export type PacketOutcome = 'sealed' | 'opened'
export type RouteAttention = 'listened' | 'skipped'
export type ReturnTone = 'kind' | 'evasive' | 'blunt'

export type IoMemoryBeat = {
  readonly id: string
  readonly text: string
  readonly references: readonly string[]
}

export const IO_FIRST_SESSION_LINES = {
  greeting: 'Night Post is closed to everyone with somewhere safer to be.',
  packetOffer: 'Blue seal. Brass box. No detours unless the stairs argue first.',
  packetWarning: 'If you open it, bring me the truth and the damage. I can route either one.',
  routeInstruction: 'Amber lantern, rope bridge, moth sign. Stop when the box hums back.',
  sealedReturn: 'Seal held. Good. Vey is short on small miracles.',
  openedReturn: 'Seal broke. So did the route. Stand still while I count what survived.',
} as const

export const IO_RETURNING_MEMORY_LINES: Record<PacketOutcome, IoMemoryBeat> = {
  sealed: {
    id: 'io-return-packet-sealed',
    text: 'You came back. So did the blue seal. That gives me two facts to trust.',
    references: ['player_returned', 'packet_delivered_sealed'],
  },
  opened: {
    id: 'io-return-packet-opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    references: ['player_returned', 'packet_opened'],
  },
}

export const IO_ROUTE_MEMORY_LINES: Record<RouteAttention, IoMemoryBeat> = {
  listened: {
    id: 'io-route-listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    references: ['player_listened_to_route'],
  },
  skipped: {
    id: 'io-route-skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    references: ['player_skipped_route'],
  },
}

export const IO_RETURN_REASON_LINES: Record<ReturnTone, IoMemoryBeat> = {
  kind: {
    id: 'io-return-kind',
    text: 'Kind answer. Dangerous tool. Do not drop it in floodwater.',
    references: ['player_answered_kindly'],
  },
  evasive: {
    id: 'io-return-evasive',
    text: 'You dodged the question cleanly. I pay couriers for cleaner routes.',
    references: ['player_answered_evasively'],
  },
  blunt: {
    id: 'io-return-blunt',
    text: 'Blunt works. So does a hammer. Use either with aim.',
    references: ['player_answered_bluntly'],
  },
}

export function getIoPacketMemoryLine(outcome: PacketOutcome): IoMemoryBeat {
  return IO_RETURNING_MEMORY_LINES[outcome]
}
