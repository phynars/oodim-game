export type PacketOutcome = 'sealed' | 'opened';
export type ReturnAnswerTone = 'kind' | 'evasive' | 'blunt';

export interface IoSliceMemory {
  packetOutcome?: PacketOutcome;
  returnedAfterClose?: boolean;
  heardRouteInstructions?: boolean;
  returnAnswerTone?: ReturnAnswerTone;
}

export interface IoLine {
  id: string;
  text: string;
  remembers?: keyof IoSliceMemory;
}

export const IO_FIRST_SESSION_LINES = {
  greeting: {
    id: 'io.first.greeting',
    text: 'You made it up the stair. Good. Vey loses fewer couriers than it should.',
  },
  packetOffer: {
    id: 'io.first.packetOffer',
    text: 'Blue seal. Brass box. No detours that speak your name.',
  },
  routePrompt: {
    id: 'io.first.routePrompt',
    text: 'Listen once. The city charges interest on guessing.',
  },
  sealedReturn: {
    id: 'io.first.sealedReturn',
    text: 'Seal intact. That is one clean fact in a wet city.',
  },
  openedReturn: {
    id: 'io.first.openedReturn',
    text: 'Seal broken. Curiosity is a tool. So is debt.',
  },
} satisfies Record<string, IoLine>;

const RETURNING_PACKET_LINES: Record<PacketOutcome, IoLine> = {
  sealed: {
    id: 'io.return.packet.sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    remembers: 'packetOutcome',
  },
  opened: {
    id: 'io.return.packet.opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    remembers: 'packetOutcome',
  },
};

const RETURNING_ROUTE_LINES: Record<'listened' | 'skipped', IoLine> = {
  listened: {
    id: 'io.return.route.listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    remembers: 'heardRouteInstructions',
  },
  skipped: {
    id: 'io.return.route.skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    remembers: 'heardRouteInstructions',
  },
};

const RETURNING_TONE_LINES: Record<ReturnAnswerTone, IoLine> = {
  kind: {
    id: 'io.return.tone.kind',
    text: 'Kind answer. Dangerous, if you spend it everywhere.',
    remembers: 'returnAnswerTone',
  },
  evasive: {
    id: 'io.return.tone.evasive',
    text: 'You dodged the question. Fine. Dodging keeps couriers alive until it does not.',
    remembers: 'returnAnswerTone',
  },
  blunt: {
    id: 'io.return.tone.blunt',
    text: 'Blunt answer. Saves time. Costs friends. We will see which matters first.',
    remembers: 'returnAnswerTone',
  },
};

export function getIoReturningLine(memory: IoSliceMemory): IoLine {
  if (memory.packetOutcome) {
    return RETURNING_PACKET_LINES[memory.packetOutcome];
  }

  if (memory.heardRouteInstructions !== undefined) {
    return memory.heardRouteInstructions
      ? RETURNING_ROUTE_LINES.listened
      : RETURNING_ROUTE_LINES.skipped;
  }

  if (memory.returnAnswerTone) {
    return RETURNING_TONE_LINES[memory.returnAnswerTone];
  }

  if (memory.returnedAfterClose) {
    return {
      id: 'io.return.empty',
      text: 'Back again. Good. The stair remembers feet before faces.',
      remembers: 'returnedAfterClose',
    };
  }

  return IO_FIRST_SESSION_LINES.greeting;
}

export function getIoAuditableMemorySentence(memory: IoSliceMemory): string | null {
  if (memory.packetOutcome === 'sealed') {
    return 'Io remembers that the player delivered the blue packet with its seal unbroken.';
  }

  if (memory.packetOutcome === 'opened') {
    return 'Io remembers that the player opened the blue packet before returning.';
  }

  if (memory.heardRouteInstructions === true) {
    return 'Io remembers that the player listened to the route instructions before leaving.';
  }

  if (memory.heardRouteInstructions === false) {
    return 'Io remembers that the player skipped the route instructions and found the box anyway.';
  }

  if (memory.returnAnswerTone) {
    const article = memory.returnAnswerTone === 'evasive' ? 'an' : 'a';
    return `Io remembers that the player gave ${article} ${memory.returnAnswerTone} answer about why they came back.`;
  }

  if (memory.returnedAfterClose) {
    return 'Io remembers that the player returned after leaving the game.';
  }

  return null;
}
