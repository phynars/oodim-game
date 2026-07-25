export type PacketOutcome = 'sealed' | 'opened' | 'unknown';
export type RouteInstructionOutcome = 'listened' | 'skipped' | 'unknown';
export type ReturnTone = 'kind' | 'evasive' | 'blunt' | 'unknown';

export interface IoPlayerMemory {
  packetOutcome: PacketOutcome;
  routeInstructionOutcome: RouteInstructionOutcome;
  returnTone: ReturnTone;
  returnedAfterFirstSession: boolean;
}

export interface IoLine {
  id: string;
  text: string;
}

export const IO_FIRST_BRIEFING_LINES: readonly IoLine[] = [
  {
    id: 'io.first-briefing.welcome',
    text: 'Night Post takes names, routes, and debts. You brought me none of those, so start with this.',
  },
  {
    id: 'io.first-briefing.packet',
    text: 'Blue seal. Brass box. Silt Stair, third landing. If the seal breaks, the city will know before I do.',
  },
  {
    id: 'io.first-briefing.route',
    text: 'Lanterns mark the safe boards. Moth-white means memory is leaking. Step around it unless you want yesterday in your shoes.',
  },
];

export const IO_RETURNING_PACKET_LINES: Record<PacketOutcome, IoLine> = {
  sealed: {
    id: 'io.return.packet.sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  },
  opened: {
    id: 'io.return.packet.opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
  },
  unknown: {
    id: 'io.return.packet.unknown',
    text: 'You came back. The ledger has a blank where the packet should be. Blanks charge interest.',
  },
};

export const IO_RETURNING_ROUTE_LINES: Record<RouteInstructionOutcome, IoLine> = {
  listened: {
    id: 'io.return.route.listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
  },
  skipped: {
    id: 'io.return.route.skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
  },
  unknown: {
    id: 'io.return.route.unknown',
    text: 'You reached the box. How much of my warning reached you is still under review.',
  },
};

export const IO_RETURNING_TONE_LINES: Record<ReturnTone, IoLine> = {
  kind: {
    id: 'io.return.tone.kind',
    text: 'You answered softly. Vey still counted it.',
  },
  evasive: {
    id: 'io.return.tone.evasive',
    text: 'You dodged the question. Fine. Couriers and rain both take indirect routes.',
  },
  blunt: {
    id: 'io.return.tone.blunt',
    text: 'Blunt answer. Useful shape. Try not to cut the wrong rope with it.',
  },
  unknown: {
    id: 'io.return.tone.unknown',
    text: 'You came back quiet. Quiet is an answer. Not always a kind one.',
  },
};

export function selectIoReturningLines(memory: IoPlayerMemory): readonly IoLine[] {
  if (!memory.returnedAfterFirstSession) {
    return [];
  }

  return [
    IO_RETURNING_PACKET_LINES[memory.packetOutcome],
    IO_RETURNING_ROUTE_LINES[memory.routeInstructionOutcome],
    IO_RETURNING_TONE_LINES[memory.returnTone],
  ];
}
