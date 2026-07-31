export type PacketOutcome = 'sealed' | 'opened' | 'withheld' | 'returned';

export type ReturnTone = 'kind' | 'evasive' | 'blunt';

export type IoRouteAttention = 'listened' | 'skipped';

export interface IoSliceMemory {
  packetOutcome?: PacketOutcome;
  returnedAfterClose?: boolean;
  routeAttention?: IoRouteAttention;
  returnTone?: ReturnTone;
  authoredMemorySentence?: string;
}

export interface IoLine {
  id: string;
  text: string;
  remembers?: keyof IoSliceMemory;
  requires?: Partial<IoSliceMemory>;
}

export const IO_FIRST_MEETING_LINES: readonly IoLine[] = [
  {
    id: 'io.first-meeting.arrival',
    text: "You're late. That is not a criticism yet.",
  },
  {
    id: 'io.first-meeting.packet',
    text: 'Blue packet. Wax seal. Box with the moth-white mark. Keep it closed if you want me to learn anything useful.',
  },
  {
    id: 'io.first-meeting.route',
    text: 'Down one stair, under the red rope, left where the lantern stutters. If the water is above your ankles, you missed the turn.',
  },
];

export const IO_PACKET_INSPECTION_LINES: Record<PacketOutcome, IoLine> = {
  sealed: {
    id: 'io.packet.sealed',
    text: 'Still sealed. Good. The city has enough mouths.',
    remembers: 'packetOutcome',
    requires: { packetOutcome: 'sealed' },
  },
  opened: {
    id: 'io.packet.opened',
    text: 'Wax broken. Curiosity is cheap; trust is not.',
    remembers: 'packetOutcome',
    requires: { packetOutcome: 'opened' },
  },
  withheld: {
    id: 'io.packet.withheld',
    text: 'You kept it. That is a delivery too. Worse paperwork.',
    remembers: 'packetOutcome',
    requires: { packetOutcome: 'withheld' },
  },
  returned: {
    id: 'io.packet.returned',
    text: 'Back where it started. Some routes are confessions.',
    remembers: 'packetOutcome',
    requires: { packetOutcome: 'returned' },
  },
};

export const IO_ROUTE_ATTENTION_LINES: Record<IoRouteAttention, IoLine> = {
  listened: {
    id: 'io.route.listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    remembers: 'routeAttention',
    requires: { routeAttention: 'listened' },
  },
  skipped: {
    id: 'io.route.skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    remembers: 'routeAttention',
    requires: { routeAttention: 'skipped' },
  },
};

export const IO_RETURN_TONE_LINES: Record<ReturnTone, IoLine> = {
  kind: {
    id: 'io.return-tone.kind',
    text: 'Kind answer. Dangerous tool. Use it deliberately.',
    remembers: 'returnTone',
    requires: { returnTone: 'kind' },
  },
  evasive: {
    id: 'io.return-tone.evasive',
    text: 'That was almost an answer. I file those under weather.',
    remembers: 'returnTone',
    requires: { returnTone: 'evasive' },
  },
  blunt: {
    id: 'io.return-tone.blunt',
    text: 'Blunt, then. Fine. Sharp things can still be clean.',
    remembers: 'returnTone',
    requires: { returnTone: 'blunt' },
  },
};

export const IO_RETURNING_SESSION_LINES: Record<'sealed' | 'opened', IoLine> = {
  sealed: {
    id: 'io.returning.sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    remembers: 'packetOutcome',
    requires: { packetOutcome: 'sealed', returnedAfterClose: true },
  },
  opened: {
    id: 'io.returning.opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    remembers: 'packetOutcome',
    requires: { packetOutcome: 'opened', returnedAfterClose: true },
  },
};

export function authoredIoMemorySentence(memory: IoSliceMemory): string | undefined {
  if (memory.authoredMemorySentence) {
    return memory.authoredMemorySentence;
  }

  if (memory.packetOutcome === 'sealed') {
    return 'You delivered the blue packet with its seal unbroken.';
  }

  if (memory.packetOutcome === 'opened') {
    return 'You opened the blue packet before delivery.';
  }

  if (memory.packetOutcome === 'withheld') {
    return 'You kept the blue packet instead of delivering it.';
  }

  if (memory.packetOutcome === 'returned') {
    return 'You brought the blue packet back to Io.';
  }

  return undefined;
}

export function selectIoReturningLine(memory: IoSliceMemory): IoLine | undefined {
  if (!memory.returnedAfterClose) {
    return undefined;
  }

  if (memory.packetOutcome === 'sealed') {
    return IO_RETURNING_SESSION_LINES.sealed;
  }

  if (memory.packetOutcome === 'opened') {
    return IO_RETURNING_SESSION_LINES.opened;
  }

  return undefined;
}

export function selectIoRouteAttentionLine(memory: IoSliceMemory): IoLine | undefined {
  if (!memory.routeAttention) {
    return undefined;
  }

  return IO_ROUTE_ATTENTION_LINES[memory.routeAttention];
}

export function selectIoReturnToneLine(memory: IoSliceMemory): IoLine | undefined {
  if (!memory.returnTone) {
    return undefined;
  }

  return IO_RETURN_TONE_LINES[memory.returnTone];
}
