export type PacketOutcome = 'sealed' | 'opened';
export type RouteBehavior = 'listened' | 'skipped';
export type ReturnAnswerTone = 'kind' | 'evasive' | 'blunt';

export interface IoFirstBeatMemory {
  packetOutcome?: PacketOutcome;
  routeBehavior?: RouteBehavior;
  returnAnswerTone?: ReturnAnswerTone;
}

export const IO_FIRST_BEAT_LINES = {
  arrival:
    'You made it before the rain learned your name. Good. Take the blue packet. Do not make it interesting.',
  packetKeptSealed:
    'Seal is clean. Box has it. That is how a city stays standing: one small refusal at a time.',
  packetOpened:
    'Wax is broken. So is the easy version of this job. Bring me what is left.',
  routePrompt:
    'Lantern with the brass hook. Stair with no third step. Box under the pharmacy saint. Repeat it if you want to live.',
  routeListened:
    'You listened before you ran. Rare habit. Keep it.',
  routeSkipped:
    'You found the box anyway. Next time, let me finish saving your life.',
  returnedKind:
    'Kind answer. Expensive habit. I will mark it under assets until Vey proves otherwise.',
  returnedEvasive:
    'You stepped around the question. Fine. Couriers need knees more than confessions.',
  returnedBlunt:
    'Blunt, then. Good. The city wastes enough breath for all of us.',
} as const;

export const IO_RETURNING_PACKET_LINES: Record<PacketOutcome, string> = {
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
} as const;

export function ioReturningLine(memory: IoFirstBeatMemory): string {
  if (memory.packetOutcome) {
    return IO_RETURNING_PACKET_LINES[memory.packetOutcome];
  }

  if (memory.routeBehavior === 'skipped') {
    return IO_FIRST_BEAT_LINES.routeSkipped;
  }

  if (memory.routeBehavior === 'listened') {
    return IO_FIRST_BEAT_LINES.routeListened;
  }

  return 'You came back. That is not nothing. Stand where I can see what the rain changed.';
}
