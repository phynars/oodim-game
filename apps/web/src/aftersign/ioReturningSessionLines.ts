// Web-view shaping for Io's returning-session lines.
//
// STRINGS are owned by the shared package (`packages/aftersign/src/
// ioReturningSession.ts`) — its header pins the wording to the script
// and the harness asserts them verbatim. This module MUST NOT redeclare
// those strings; it sources each `line` via `getIoReturningSessionLine`.

import {
  getIoReturningSessionLine,
  type IoPacketOutcome,
  type IoRouteAttention,
} from '../../../../packages/aftersign/src/ioReturningSession';

export type { IoPacketOutcome, IoRouteAttention };

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
    line: getIoReturningSessionLine('sealedPacket'),
  },
  packetOpened: {
    kind: 'packet',
    outcome: 'opened',
    rememberedAction: 'The player opened the first sealed packet before delivery.',
    line: getIoReturningSessionLine('openedPacket'),
  },
  routeListened: {
    kind: 'route',
    outcome: 'listened',
    rememberedAction: "The player listened to Io's route instructions before leaving.",
    line: getIoReturningSessionLine('listenedRoute'),
  },
  routeSkipped: {
    kind: 'route',
    outcome: 'skipped',
    rememberedAction: 'The player skipped away before Io finished the route instructions.',
    line: getIoReturningSessionLine('skippedRoute'),
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
