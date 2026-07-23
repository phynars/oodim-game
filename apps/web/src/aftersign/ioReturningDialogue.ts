export type AftersignPacketOutcome = 'sealed' | 'opened'
export type AftersignRouteAttention = 'listened' | 'skipped'

export type AftersignIoMemory = {
  packetOutcome?: AftersignPacketOutcome
  routeAttention?: AftersignRouteAttention
  returnedAfterClose?: boolean
}

export type AftersignIoMemoryReference =
  | 'packet.delivered_sealed'
  | 'packet.opened'
  | 'route.listened'
  | 'route.skipped'
  | 'player.returned'

export type AftersignIoReturningLine = {
  id: string
  text: string
  references: AftersignIoMemoryReference[]
}

const IO_RETURNING_LINES = {
  sealed: {
    id: 'io.returning.packet.sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    references: ['player.returned', 'packet.delivered_sealed'],
  },
  opened: {
    id: 'io.returning.packet.opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    references: ['player.returned', 'packet.opened'],
  },
  skippedRoute: {
    id: 'io.returning.route.skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    references: ['route.skipped'],
  },
  listenedRoute: {
    id: 'io.returning.route.listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    references: ['route.listened'],
  },
  fallback: {
    id: 'io.returning.fallback',
    text: 'Back again. Good. Vey wastes fewer facts on the familiar.',
    references: [],
  },
} satisfies Record<string, AftersignIoReturningLine>

export function chooseAftersignIoReturningLine(memory: AftersignIoMemory): AftersignIoReturningLine {
  if (memory.packetOutcome === 'sealed') {
    return IO_RETURNING_LINES.sealed
  }

  if (memory.packetOutcome === 'opened') {
    return IO_RETURNING_LINES.opened
  }

  if (memory.routeAttention === 'skipped') {
    return IO_RETURNING_LINES.skippedRoute
  }

  if (memory.routeAttention === 'listened') {
    return IO_RETURNING_LINES.listenedRoute
  }

  return IO_RETURNING_LINES.fallback
}

export function getAftersignIoReturningLines(): AftersignIoReturningLine[] {
  return [
    IO_RETURNING_LINES.sealed,
    IO_RETURNING_LINES.opened,
    IO_RETURNING_LINES.skippedRoute,
    IO_RETURNING_LINES.listenedRoute,
    IO_RETURNING_LINES.fallback,
  ]
}
