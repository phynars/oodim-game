export type PacketOutcome = 'sealed' | 'opened' | 'unknown';

export type RouteAttention = 'listened' | 'skipped' | 'unknown';

export type ReturnAnswerTone = 'kind' | 'evasive' | 'blunt' | 'unknown';

export interface IoSliceMemory {
  packetOutcome: PacketOutcome;
  routeAttention?: RouteAttention;
  returnAnswerTone?: ReturnAnswerTone;
  returnedAfterClose?: boolean;
}

export interface IoLine {
  id: string;
  text: string;
  remembers: string[];
}

export const ioFirstSessionLines = {
  greeting: {
    id: 'io.first.greeting',
    text: 'No name on you. Fine. Names leak in this weather.',
    remembers: [],
  },
  packetOffer: {
    id: 'io.first.packetOffer',
    text: 'Blue packet. Wax stays whole. You get it to the sign box, then you come back with your hands empty.',
    remembers: [],
  },
  routePrompt: {
    id: 'io.first.routePrompt',
    text: 'Lantern, stair, red string, bell. Miss one and the city gets to keep you.',
    remembers: [],
  },
  sealedReturn: {
    id: 'io.first.sealedReturn',
    text: 'Seal intact. Good. Vey can use one more pair of clean hands.',
    remembers: ['packetOutcome:sealed'],
  },
  openedReturn: {
    id: 'io.first.openedReturn',
    text: 'Wax broken. Curiosity is a tool. So is a knife. Learn which one you are holding.',
    remembers: ['packetOutcome:opened'],
  },
} as const satisfies Record<string, IoLine>;

export function ioMemorySentence(memory: IoSliceMemory): string {
  if (memory.packetOutcome === 'sealed') {
    return 'The courier delivered the blue packet with its seal unbroken.';
  }

  if (memory.packetOutcome === 'opened') {
    return 'The courier opened the blue packet before delivery.';
  }

  return 'The courier returned to the Night Post, but the packet outcome is not recorded.';
}

export function ioReturningLine(memory: IoSliceMemory): IoLine {
  if (memory.packetOutcome === 'sealed') {
    return {
      id: 'io.return.packetSealed',
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      remembers: memory.returnedAfterClose
        ? ['packetOutcome:sealed', 'returnedAfterClose']
        : ['packetOutcome:sealed'],
    };
  }

  if (memory.packetOutcome === 'opened') {
    return {
      id: 'io.return.packetOpened',
      text: 'You came back. The seal did not. I can use one of those facts.',
      remembers: memory.returnedAfterClose
        ? ['packetOutcome:opened', 'returnedAfterClose']
        : ['packetOutcome:opened'],
    };
  }

  if (memory.routeAttention === 'skipped') {
    return {
      id: 'io.return.routeSkipped',
      text: 'You found the box anyway. Next time, let me finish saving your life.',
      remembers: ['routeAttention:skipped'],
    };
  }

  if (memory.routeAttention === 'listened') {
    return {
      id: 'io.return.routeListened',
      text: 'You listened before you ran. Rare habit. Keep it.',
      remembers: ['routeAttention:listened'],
    };
  }

  if (memory.returnAnswerTone === 'kind') {
    return {
      id: 'io.return.answerKind',
      text: 'Kind answer last time. Dangerous habit. Useful one.',
      remembers: ['returnAnswerTone:kind'],
    };
  }

  if (memory.returnAnswerTone === 'evasive') {
    return {
      id: 'io.return.answerEvasive',
      text: 'You dodged the question. Vey noticed. I wrote it down.',
      remembers: ['returnAnswerTone:evasive'],
    };
  }

  if (memory.returnAnswerTone === 'blunt') {
    return {
      id: 'io.return.answerBlunt',
      text: 'Blunt answer. Not gentle. Not useless.',
      remembers: ['returnAnswerTone:blunt'],
    };
  }

  return {
    id: 'io.return.bare',
    text: 'Back again. Good. The city wastes less time on people who return.',
    remembers: memory.returnedAfterClose ? ['returnedAfterClose'] : [],
  };
}
