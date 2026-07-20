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
  type IoReturnAnswerTone,
  type IoRouteAttention,
} from '../../../../packages/aftersign/src/ioReturningSession'

export type { IoPacketOutcome, IoReturnAnswerTone, IoRouteAttention }

export interface IoReturningSessionMemory {
  packetOutcome: IoPacketOutcome
  routeInstructionBehavior?: IoRouteAttention
  returnAnswerTone?: IoReturnAnswerTone
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

type IoReturningSessionChainedKey = `${IoPacketOutcome}Packet${Capitalize<IoRouteAttention>}Route`

export const IO_RETURNING_SESSION_CHAINED_LINES: Record<
  IoReturningSessionChainedKey,
  IoReturningSessionMemoryLine
> = {
  sealedPacketListenedRoute: {
    id: 'io-return-sealed-listened-route',
    rememberedAction:
      'Player delivered the packet sealed and listened to Io\'s full route instructions before leaving.',
    text: getIoReturningSessionLineFromPackage('sealedPacketListenedRoute'),
  },
  sealedPacketSkippedRoute: {
    id: 'io-return-sealed-skipped-route',
    rememberedAction:
      'Player delivered the packet sealed but left before Io finished the route instructions.',
    text: getIoReturningSessionLineFromPackage('sealedPacketSkippedRoute'),
  },
  openedPacketListenedRoute: {
    id: 'io-return-opened-listened-route',
    rememberedAction:
      'Player opened the packet before delivery and still listened to Io\'s full route instructions.',
    text: getIoReturningSessionLineFromPackage('openedPacketListenedRoute'),
  },
  openedPacketSkippedRoute: {
    id: 'io-return-opened-skipped-route',
    rememberedAction:
      'Player opened the packet before delivery and left before Io finished the route instructions.',
    text: getIoReturningSessionLineFromPackage('openedPacketSkippedRoute'),
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

// Posture is the tone the player struck when Io asked why they came back.
// Only spoken AFTER the packet-return line — never a substitute for it.
export const IO_RETURN_POSTURE_LINES: Record<IoReturnAnswerTone, IoReturningSessionMemoryLine> = {
  kind: {
    id: 'io-return-kind',
    rememberedAction: 'Player answered Io kindly when asked why they returned.',
    text: getIoReturningSessionLineFromPackage('kindReturn'),
  },
  evasive: {
    id: 'io-return-evasive',
    rememberedAction: 'Player deflected when Io asked why they returned.',
    text: getIoReturningSessionLineFromPackage('evasiveReturn'),
  },
  blunt: {
    id: 'io-return-blunt',
    rememberedAction: 'Player answered Io bluntly when asked why they returned.',
    text: getIoReturningSessionLineFromPackage('bluntReturn'),
  },
}

// Renamed to avoid shadowing the package's `getIoReturningSessionLine`
// export (which returns a raw string keyed by line id). The web view
// returns the decorated memory record instead — different signature,
// different behavior, so it gets a different name.
export function getIoReturningSessionMemoryLine(
  memory: IoReturningSessionMemory,
): IoReturningSessionMemoryLine {
  if (memory.routeInstructionBehavior) {
    const chainedKey = `${memory.packetOutcome}Packet${memory.routeInstructionBehavior === 'listened' ? 'Listened' : 'Skipped'}Route` as const
    return IO_RETURNING_SESSION_CHAINED_LINES[chainedKey]
  }

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

export function getIoReturnPostureLine(
  memory: IoReturningSessionMemory,
): IoReturningSessionMemoryLine | undefined {
  if (!memory.returnAnswerTone) {
    return undefined
  }

  return IO_RETURN_POSTURE_LINES[memory.returnAnswerTone]
}

// Full recognition surface for a returning session: the packet-return line
// (always present — it's what Io opens with), then optional posture reflection.
// Route memory is folded into the packet line when both memories are present.
export function getIoReturningSessionRecognitionLines(
  memory: IoReturningSessionMemory,
): readonly IoReturningSessionMemoryLine[] {
  const lines: IoReturningSessionMemoryLine[] = [
    getIoReturningSessionMemoryLine(memory),
  ]

  const posture = getIoReturnPostureLine(memory)
  if (posture) lines.push(posture)

  return lines
}
