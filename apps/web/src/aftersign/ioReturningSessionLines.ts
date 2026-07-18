export type IoPacketOutcome = 'sealed' | 'opened'

export interface IoReturningSessionMemory {
  packetOutcome: IoPacketOutcome
  returnedAfterClose?: boolean
  routeInstructionBehavior?: 'listened' | 'skipped'
}

export interface IoReturningSessionLine {
  readonly id: string
  readonly rememberedAction: string
  readonly text: string
}

export const IO_RETURNING_SESSION_LINES: Record<IoPacketOutcome, IoReturningSessionLine> = {
  sealed: {
    id: 'io-return-sealed-packet',
    rememberedAction: 'Player delivered the first blue packet with its seal unbroken.',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  },
  opened: {
    id: 'io-return-opened-packet',
    rememberedAction: 'Player opened the first blue packet before delivery.',
    text: 'You came back. The seal did not. I can use one of those facts.',
  },
}

export const IO_ROUTE_MEMORY_LINES: Record<NonNullable<IoReturningSessionMemory['routeInstructionBehavior']>, IoReturningSessionLine> = {
  listened: {
    id: 'io-route-listened',
    rememberedAction: 'Player listened to Io before leaving the kiosk.',
    text: 'You listened before you ran. Rare habit. Keep it.',
  },
  skipped: {
    id: 'io-route-skipped',
    rememberedAction: 'Player left before Io finished the route instructions.',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
  },
}

export function getIoReturningSessionLine(memory: IoReturningSessionMemory): IoReturningSessionLine {
  return IO_RETURNING_SESSION_LINES[memory.packetOutcome]
}

export function getIoRouteMemoryLine(
  memory: IoReturningSessionMemory,
): IoReturningSessionLine | undefined {
  if (!memory.routeInstructionBehavior) {
    return undefined
  }

  return IO_ROUTE_MEMORY_LINES[memory.routeInstructionBehavior]
}
