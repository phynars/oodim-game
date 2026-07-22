export type IoPacketOutcome = 'sealed' | 'opened' | 'withheld' | 'returned'
export type IoRouteAttention = 'listened' | 'skipped'
export type IoReturnAnswerTone = 'kind' | 'evasive' | 'blunt'

export type IoReturningSessionLineKey =
  | 'sealedPacket'
  | 'openedPacket'
  | 'withheldPacket'
  | 'returnedPacket'
  | 'sealedPacketListenedRoute'
  | 'sealedPacketSkippedRoute'
  | 'openedPacketListenedRoute'
  | 'openedPacketSkippedRoute'
  | 'listenedRoute'
  | 'skippedRoute'
  | 'kindReturn'
  | 'evasiveReturn'
  | 'bluntReturn'
  | 'bareReturn'

// Lines are pinned to docs/flagship/vertical-slice-script.md §7–§8.
// Do not paraphrase; the harness asserts these strings verbatim.
export const ioReturningSessionLines: Record<IoReturningSessionLineKey, string> = {
  sealedPacket:
    'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  openedPacket: 'You came back. The seal did not. I can use one of those facts.',
  withheldPacket:
    'You came back with the packet still in your pocket. That is not nothing. It is not delivery.',
  returnedPacket:
    'You brought the work back instead of losing it. Bad news, neatly labeled, still counts.',
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
  bareReturn:
    'You came back. That is the only fact I have on you, and it is the one I weigh heaviest.',
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
  if (memory.packetOutcome === 'withheld') return ioReturningSessionLines.withheldPacket
  if (memory.packetOutcome === 'returned') return ioReturningSessionLines.returnedPacket
  if (memory.routeAttention === 'skipped') return ioReturningSessionLines.skippedRoute
  if (memory.routeAttention === 'listened') return ioReturningSessionLines.listenedRoute
  if (memory.returnAnswerTone === 'kind') return ioReturningSessionLines.kindReturn
  if (memory.returnAnswerTone === 'evasive') return ioReturningSessionLines.evasiveReturn
  if (memory.returnAnswerTone === 'blunt') return ioReturningSessionLines.bluntReturn
  // Empty memory: no packet outcome, no route, no tone. Io still recognizes
  // the return itself — the one fact she always keeps (#731).
  return ioReturningSessionLines.bareReturn
}
