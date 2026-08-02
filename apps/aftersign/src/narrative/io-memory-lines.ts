export type IoPacketOutcome = 'sealed' | 'opened';
export type IoRouteAttention = 'listened' | 'skipped';
export type IoReturnTone = 'kind' | 'evasive' | 'blunt';

export type IoMemoryLineId =
  | 'io.return.packet.sealed'
  | 'io.return.packet.opened'
  | 'io.route.skipped'
  | 'io.route.listened'
  | 'io.return.tone.kind'
  | 'io.return.tone.evasive'
  | 'io.return.tone.blunt';

export interface IoMemoryLine {
  id: IoMemoryLineId;
  text: string;
  rememberedFacts: string[];
}

export interface IoMemoryState {
  packetOutcome?: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
  returnTone?: IoReturnTone;
}

export const IO_MEMORY_LINES: Record<IoMemoryLineId, IoMemoryLine> = {
  'io.return.packet.sealed': {
    id: 'io.return.packet.sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    rememberedFacts: ['io.returned', 'packet.blueSeal.unbroken'],
  },
  'io.return.packet.opened': {
    id: 'io.return.packet.opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    rememberedFacts: ['io.returned', 'packet.blueSeal.opened'],
  },
  'io.route.skipped': {
    id: 'io.route.skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    rememberedFacts: ['route.instructions.skipped', 'signBox.found'],
  },
  'io.route.listened': {
    id: 'io.route.listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    rememberedFacts: ['route.instructions.listened'],
  },
  'io.return.tone.kind': {
    id: 'io.return.tone.kind',
    text: 'Kind answer. Dangerous habit. Useful one.',
    rememberedFacts: ['io.returned', 'returnAnswer.kind'],
  },
  'io.return.tone.evasive': {
    id: 'io.return.tone.evasive',
    text: 'You dodged the question. Fine. Couriers use alleys too.',
    rememberedFacts: ['io.returned', 'returnAnswer.evasive'],
  },
  'io.return.tone.blunt': {
    id: 'io.return.tone.blunt',
    text: 'Blunt is workable. It leaves fewer places for rot.',
    rememberedFacts: ['io.returned', 'returnAnswer.blunt'],
  },
};

export function selectIoMemoryLines(state: IoMemoryState): IoMemoryLine[] {
  const lines: IoMemoryLine[] = [];

  if (state.packetOutcome === 'sealed') {
    lines.push(IO_MEMORY_LINES['io.return.packet.sealed']);
  }

  if (state.packetOutcome === 'opened') {
    lines.push(IO_MEMORY_LINES['io.return.packet.opened']);
  }

  if (state.routeAttention === 'skipped') {
    lines.push(IO_MEMORY_LINES['io.route.skipped']);
  }

  if (state.routeAttention === 'listened') {
    lines.push(IO_MEMORY_LINES['io.route.listened']);
  }

  if (state.returnTone === 'kind') {
    lines.push(IO_MEMORY_LINES['io.return.tone.kind']);
  }

  if (state.returnTone === 'evasive') {
    lines.push(IO_MEMORY_LINES['io.return.tone.evasive']);
  }

  if (state.returnTone === 'blunt') {
    lines.push(IO_MEMORY_LINES['io.return.tone.blunt']);
  }

  return lines;
}
