export type PacketOutcome = 'sealed' | 'opened' | 'withheld' | 'returned';

export type RouteInstructionOutcome = 'listened' | 'skipped' | 'unknown';

export type ReturnTone = 'kind' | 'evasive' | 'blunt' | 'unknown';

export interface IoPlayerMemory {
  returnedAfterFirstSession: boolean;
  packetOutcome?: PacketOutcome;
  routeInstructionOutcome?: RouteInstructionOutcome;
  returnTone?: ReturnTone;
}

export interface IoLine {
  id: string;
  text: string;
  remembers: keyof IoPlayerMemory;
  value: string | boolean;
}

export const ioFirstBriefingLines = [
  {
    id: 'io-briefing-packet',
    text: 'Blue seal. North stair. Sign box with the brass moth. Bring me back the truth, not a story.',
  },
  {
    id: 'io-briefing-warning',
    text: 'If the stair coughs up fog, stop. Vey eats hurry first.',
  },
] as const;

const packetReturnLines: Record<PacketOutcome, IoLine> = {
  sealed: {
    id: 'io-return-packet-sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    remembers: 'packetOutcome',
    value: 'sealed',
  },
  opened: {
    id: 'io-return-packet-opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    remembers: 'packetOutcome',
    value: 'opened',
  },
  withheld: {
    id: 'io-return-packet-withheld',
    text: 'You came back light. Somewhere in the stair, my packet got heavier.',
    remembers: 'packetOutcome',
    value: 'withheld',
  },
  returned: {
    id: 'io-return-packet-returned',
    text: 'You brought it back instead of guessing brave. Good. The city kills plenty of poets.',
    remembers: 'packetOutcome',
    value: 'returned',
  },
};

const routeReturnLines: Record<Exclude<RouteInstructionOutcome, 'unknown'>, IoLine> = {
  listened: {
    id: 'io-return-route-listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    remembers: 'routeInstructionOutcome',
    value: 'listened',
  },
  skipped: {
    id: 'io-return-route-skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    remembers: 'routeInstructionOutcome',
    value: 'skipped',
  },
};

const toneReturnLines: Record<Exclude<ReturnTone, 'unknown'>, IoLine> = {
  kind: {
    id: 'io-return-tone-kind',
    text: 'You made kindness sound like a working tool. Strange. Useful.',
    remembers: 'returnTone',
    value: 'kind',
  },
  evasive: {
    id: 'io-return-tone-evasive',
    text: 'You dodged the question. I marked the shape of the dodge.',
    remembers: 'returnTone',
    value: 'evasive',
  },
  blunt: {
    id: 'io-return-tone-blunt',
    text: 'Blunt answer. Clean edge. Try not to cut the hand that signs your route.',
    remembers: 'returnTone',
    value: 'blunt',
  },
};

export function selectIoReturningLines(memory: IoPlayerMemory): IoLine[] {
  if (!memory.returnedAfterFirstSession) {
    return [];
  }

  const lines: IoLine[] = [
    {
      id: 'io-return-base',
      text: 'You came back. Vey writes that down before I do.',
      remembers: 'returnedAfterFirstSession',
      value: true,
    },
  ];

  if (memory.packetOutcome) {
    lines.push(packetReturnLines[memory.packetOutcome]);
  }

  if (memory.routeInstructionOutcome && memory.routeInstructionOutcome !== 'unknown') {
    lines.push(routeReturnLines[memory.routeInstructionOutcome]);
  }

  if (memory.returnTone && memory.returnTone !== 'unknown') {
    lines.push(toneReturnLines[memory.returnTone]);
  }

  return lines;
}
