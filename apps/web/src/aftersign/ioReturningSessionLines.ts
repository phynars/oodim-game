// Web view over Io's returning-session lines.
//
// The strings themselves are owned by
// `packages/aftersign/src/ioReturningSession.ts` — the harness asserts
// those verbatim and `ioFirstSessionCopy.ts` calls duplication here a
// regression. This module only decorates each canonical line with the
// web-side metadata (a stable id + a plain-English `rememberedAction`
// note) that the UI needs to explain WHY Io is saying it.
//
// If a line ever needs to change, edit the package. The parity test
// alongside this file will fail loudly if the web view drifts.

import {
  getIoReturningSessionLine as getIoReturningSessionLineFromPackage,
  type IoPacketOutcome,
  type IoRouteAttention,
} from '../../../../packages/aftersign/src/ioReturningSession'

export type { IoPacketOutcome, IoRouteAttention }

export interface IoReturningSessionMemory {
  packetOutcome: IoPacketOutcome
  routeInstructionBehavior?: IoRouteAttention
}

export interface IoReturningSessionMemoryLine {
  readonly id: string
  readonly rememberedAction: string
  readonly text: string
}

export const IO_RETURNING_SESSION_LINES: Record<IoPacketOutcome, IoReturningSessionMemoryLine> = {
  sealed: {
    id: 'io-return-sealed-packet',
    rememberedAction: 'Player delivered the first blue packet with its seal unbroken.',
    text: getIoReturningSessionLineFromPackage('sealedPacket'),
  },
  opened: {
    id: 'io-return-opened-packet',
    rememberedAction: 'Player opened the first blue packet before delivery.',
    text: getIoReturningSessionLineFromPackage('openedPacket'),
  },
}

export const IO_ROUTE_MEMORY_LINES: Record<IoRouteAttention, IoReturningSessionMemoryLine> = {
  listened: {
    id: 'io-route-listened',
    rememberedAction: 'Player listened to Io before leaving the kiosk.',
    text: getIoReturningSessionLineFromPackage('listenedRoute'),
  },
  skipped: {
    id: 'io-route-skipped',
    rememberedAction: 'Player left before Io finished the route instructions.',
    text: getIoReturningSessionLineFromPackage('skippedRoute'),
  },
}

// Renamed to avoid shadowing the package's `getIoReturningSessionLine`
// export (which returns a raw string keyed by line id). The web view
// returns the decorated memory record instead — different signature,
// different behavior, so it gets a different name.
export function getIoReturningSessionMemoryLine(
  memory: IoReturningSessionMemory,
): IoReturningSessionMemoryLine {
  return IO_RETURNING_SESSION_LINES[memory.packetOutcome]
}

export function getIoRouteMemoryLine(
  memory: IoReturningSessionMemory,
): IoReturningSessionMemoryLine | undefined {
  if (!memory.routeInstructionBehavior) {
    return undefined
  }

  return IO_ROUTE_MEMORY_LINES[memory.routeInstructionBehavior]
}
