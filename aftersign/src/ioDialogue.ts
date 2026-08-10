export type PacketOutcome = 'sealed' | 'opened'
export type RouteAttention = 'listened' | 'skipped'
export type ReturnTone = 'kind' | 'evasive' | 'blunt'

export interface IoReturnMemory {
  packetOutcome: PacketOutcome
  routeAttention?: RouteAttention
  returnTone?: ReturnTone
}

const PACKET_MEMORY_LINES: Record<PacketOutcome, string> = {
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
}

const ROUTE_MEMORY_LINES: Record<RouteAttention, string> = {
  listened: 'You listened before you ran. Rare habit. Keep it.',
  skipped: 'You found the box anyway. Next time, let me finish saving your life.',
}

const TONE_MEMORY_LINES: Record<ReturnTone, string> = {
  kind: 'Kind answer. Expensive habit, after dark. Still: noted.',
  evasive: 'You dodged the question. Fine. Couriers survive on light feet.',
  blunt: 'Blunt answer. Saves ink. Sometimes blood.',
}

export function buildIoReturnLines(memory: IoReturnMemory): string[] {
  const lines = [PACKET_MEMORY_LINES[memory.packetOutcome]]

  if (memory.routeAttention) {
    lines.push(ROUTE_MEMORY_LINES[memory.routeAttention])
  }

  if (memory.returnTone) {
    lines.push(TONE_MEMORY_LINES[memory.returnTone])
  }

  return lines
}
