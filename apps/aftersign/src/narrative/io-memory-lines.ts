export type IoPacketOutcome = 'sealed' | 'opened'
export type IoInstructionOutcome = 'listened' | 'skipped'
export type IoReturnTone = 'kind' | 'evasive' | 'blunt'

export type IoMemoryState = {
  packetOutcome?: IoPacketOutcome
  instructionOutcome?: IoInstructionOutcome
  returnTone?: IoReturnTone
  returnedAfterClose?: boolean
}

export type IoMemoryLine = {
  id: string
  text: string
  requires: Partial<IoMemoryState>
}

export const ioReturningPacketLines: Record<IoPacketOutcome, IoMemoryLine> = {
  sealed: {
    id: 'io-return-packet-sealed',
    requires: { packetOutcome: 'sealed', returnedAfterClose: true },
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  },
  opened: {
    id: 'io-return-packet-opened',
    requires: { packetOutcome: 'opened', returnedAfterClose: true },
    text: 'You came back. The seal did not. I can use one of those facts.',
  },
}

export const ioInstructionMemoryLines: Record<IoInstructionOutcome, IoMemoryLine> = {
  listened: {
    id: 'io-instructions-listened',
    requires: { instructionOutcome: 'listened' },
    text: 'You listened before you ran. Rare habit. Keep it.',
  },
  skipped: {
    id: 'io-instructions-skipped',
    requires: { instructionOutcome: 'skipped' },
    text: 'You found the box anyway. Next time, let me finish saving your life.',
  },
}

export const ioReturnToneLines: Record<IoReturnTone, IoMemoryLine> = {
  kind: {
    id: 'io-return-tone-kind',
    requires: { returnTone: 'kind', returnedAfterClose: true },
    text: 'Kind answer. Expensive habit in Vey. Spend it where it counts.',
  },
  evasive: {
    id: 'io-return-tone-evasive',
    requires: { returnTone: 'evasive', returnedAfterClose: true },
    text: 'You dodged the question. Fine. Couriers survive by keeping one door behind them.',
  },
  blunt: {
    id: 'io-return-tone-blunt',
    requires: { returnTone: 'blunt', returnedAfterClose: true },
    text: 'Blunt answer. Good. The city already owns enough fog.',
  },
}

export const ioFirstBriefingLines: string[] = [
  'Blue packet. Brass box. No detours that ask for your name.',
  'If a stair hums, it remembers weight. Step light.',
  'If a sign whispers twice, answer once. More than that is bargaining.',
  'Bring the packet back sealed and I learn one thing. Bring yourself back alive and I learn another.',
]

export function getIoReturningMemoryLine(memory: IoMemoryState): IoMemoryLine | null {
  if (!memory.returnedAfterClose) return null

  if (memory.packetOutcome) {
    return ioReturningPacketLines[memory.packetOutcome]
  }

  if (memory.instructionOutcome) {
    return ioInstructionMemoryLines[memory.instructionOutcome]
  }

  if (memory.returnTone) {
    return ioReturnToneLines[memory.returnTone]
  }

  return null
}
