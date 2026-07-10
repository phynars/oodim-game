export type IoPacketOutcome = 'sealed' | 'opened'
export type IoRouteAttention = 'listened' | 'skipped'
export type IoReturnAnswerTone = 'kind' | 'evasive' | 'blunt'

export type IoReturningSessionLineKey =
  | 'sealedPacket'
  | 'openedPacket'
  | 'listenedRoute'
  | 'skippedRoute'
  | 'kindReturn'
  | 'evasiveReturn'
  | 'bluntReturn'
  | 'fallback'

export const ioReturningSessionLines: Record<IoReturningSessionLineKey, string> = {
  sealedPacket:
    'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  openedPacket: 'You came back. The seal did not. I can use one of those facts.',
  listenedRoute: 'You listened before you ran. Rare habit. Keep it.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  kindReturn: 'Kind answer. Dangerous tool. Keep it sharp.',
  evasiveReturn: 'You walked around the question. I noticed the shape of the path.',
  bluntReturn: 'Blunt, then. Fine. A dull knife still opens rope.',
  fallback: 'Back again. Good. Vey is less cruel to repeat witnesses.',
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
  if (memory.packetOutcome === 'sealed') return ioReturningSessionLines.sealedPacket
  if (memory.packetOutcome === 'opened') return ioReturningSessionLines.openedPacket
  if (memory.routeAttention === 'listened') return ioReturningSessionLines.listenedRoute
  if (memory.routeAttention === 'skipped') return ioReturningSessionLines.skippedRoute
  if (memory.returnAnswerTone === 'kind') return ioReturningSessionLines.kindReturn
  if (memory.returnAnswerTone === 'evasive') return ioReturningSessionLines.evasiveReturn
  if (memory.returnAnswerTone === 'blunt') return ioReturningSessionLines.bluntReturn
  return ioReturningSessionLines.fallback
}
