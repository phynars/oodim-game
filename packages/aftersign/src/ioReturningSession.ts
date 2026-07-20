export type IoPacketOutcome = 'sealed' | 'opened'
export type IoRouteAttention = 'listened' | 'skipped'
export type IoReturnAnswerTone = 'kind' | 'evasive' | 'blunt'

export type IoReturningSessionLineKey =
  | 'sealedPacket'
  | 'openedPacket'
  | 'sealedPacketListenedRoute'
  | 'sealedPacketSkippedRoute'
  | 'openedPacketListenedRoute'
  | 'openedPacketSkippedRoute'
  | 'listenedRoute'
  | 'skippedRoute'
  | 'kindReturn'
  | 'evasiveReturn'
  | 'bluntReturn'

// Lines are pinned to docs/flagship/vertical-slice-script.md §7–§8.
// Do not paraphrase; the harness asserts these strings verbatim.
export const ioReturningSessionLines: Record<IoReturningSessionLineKey, string> = {
  sealedPacket:
    'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  openedPacket: 'You came back. The seal did not. I can use one of those facts.',
  sealedPacketListenedRoute:
    'You came back with the blue seal unbroken, and you listened before you ran. That gives me two good facts and no excuses.',
  sealedPacketSkippedRoute:
    'You came back with the blue seal unbroken, and you still ran before the route finished. Reliable hands, impatient feet.',
  openedPacketListenedRoute:
    'You came back with a broken seal, but you listened before you ran. One clean habit is still a habit.',
  openedPacketSkippedRoute:
    'You came back with a broken seal and half my route. That is not ideal, but it is enough to route.',
  listenedRoute: 'You listened before you ran. Rare habit. Keep it.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  kindReturn:
    'Careful. Say that too often and people will start handing you breakable things.',
  evasiveReturn: 'Work is a clean word. We can use it until it stains.',
  bluntReturn: 'Good. Wanting is easier to route than pretending.',
}

export interface IoReturningSessionMemory {
  packetOutcome?: IoPacketOutcome
  routeAttention?: IoRouteAttention
  returnAnswerTone?: IoReturnAnswerTone
}

export function getIoReturningSessionLine(key: IoReturningSessionLineKey): string {
  return ioReturningSessionLines[key]
}

export function chooseIoReturningSessionLine(
  memory: IoReturningSessionMemory,
): string {
  if (memory.packetOutcome === 'sealed' && memory.routeAttention === 'listened') {
    return ioReturningSessionLines.sealedPacketListenedRoute
  }
  if (memory.packetOutcome === 'sealed' && memory.routeAttention === 'skipped') {
    return ioReturningSessionLines.sealedPacketSkippedRoute
  }
  if (memory.packetOutcome === 'opened' && memory.routeAttention === 'listened') {
    return ioReturningSessionLines.openedPacketListenedRoute
  }
  if (memory.packetOutcome === 'opened' && memory.routeAttention === 'skipped') {
    return ioReturningSessionLines.openedPacketSkippedRoute
  }

  if (memory.packetOutcome === 'sealed') return ioReturningSessionLines.sealedPacket
  if (memory.packetOutcome === 'opened') return ioReturningSessionLines.openedPacket
  if (memory.routeAttention === 'skipped') return ioReturningSessionLines.skippedRoute
  if (memory.routeAttention === 'listened') return ioReturningSessionLines.listenedRoute
  if (memory.returnAnswerTone === 'kind') return ioReturningSessionLines.kindReturn
  if (memory.returnAnswerTone === 'evasive') return ioReturningSessionLines.evasiveReturn
  if (memory.returnAnswerTone === 'blunt') return ioReturningSessionLines.bluntReturn
  // Empty memory: no packet outcome, no route, no tone. The script has no
  // authored line for this shape; default to the route-listened tone, which
  // is the mildest observation Io can make about a returning stranger.
  return ioReturningSessionLines.listenedRoute
}
