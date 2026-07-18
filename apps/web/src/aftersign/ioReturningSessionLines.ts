export type IoPacketOutcome = 'sealed' | 'opened';
export type IoRouteAttention = 'listened' | 'skipped';

export type IoReturnMemory =
  | {
      kind: 'packet';
      outcome: IoPacketOutcome;
      rememberedAction: string;
      line: string;
    }
  | {
      kind: 'route';
      outcome: IoRouteAttention;
      rememberedAction: string;
      line: string;
    };

export const IO_RETURN_MEMORIES = {
  packetSealed: {
    kind: 'packet',
    outcome: 'sealed',
    rememberedAction: 'The player delivered the first sealed packet unopened.',
    line: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  },
  packetOpened: {
    kind: 'packet',
    outcome: 'opened',
    rememberedAction: 'The player opened the first sealed packet before delivery.',
    line: 'You came back. The seal did not. I can use one of those facts.',
  },
  routeListened: {
    kind: 'route',
    outcome: 'listened',
    rememberedAction: 'The player listened to Io\'s route instructions before leaving.',
    line: 'You listened before you ran. Rare habit. Keep it.',
  },
  routeSkipped: {
    kind: 'route',
    outcome: 'skipped',
    rememberedAction: 'The player skipped away before Io finished the route instructions.',
    line: 'You found the box anyway. Next time, let me finish saving your life.',
  },
} as const satisfies Record<string, IoReturnMemory>;

export type IoReturnMemoryKey = keyof typeof IO_RETURN_MEMORIES;

export function getIoPacketReturnLine(outcome: IoPacketOutcome): string {
  return outcome === 'sealed'
    ? IO_RETURN_MEMORIES.packetSealed.line
    : IO_RETURN_MEMORIES.packetOpened.line;
}

export function getIoRouteReturnLine(outcome: IoRouteAttention): string {
  return outcome === 'listened'
    ? IO_RETURN_MEMORIES.routeListened.line
    : IO_RETURN_MEMORIES.routeSkipped.line;
}
