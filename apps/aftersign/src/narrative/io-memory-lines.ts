// Thin shim over io-recognition-beat.ts. That module is the ONE source of
// truth for Io's voice — this file must never fork her lines. All text and
// remembered-fact strings here are DERIVED from the canonical beats; if you
// need to change what Io says, edit io-recognition-beat.ts.
//
// What this shim adds on top of the canonical selector:
//   • A stable, dot-namespaced `IoMemoryLineId` set the persistence layer and
//     analytics can key on without depending on beat IDs.
//   • `selectIoMemoryLines` — composes MULTIPLE beats (packet + route + tone)
//     into an ordered list, whereas `selectIoRecognitionBeat` returns exactly
//     one line for a given moment. The slice surface uses the single line;
//     memory-audit surfaces use the composed list.
//
// The fresh-session guard mirrors `selectIoReturningLine`: no packet memory
// line surfaces until `completedDeliveryIds` records the first delivery.

import {
  FIRST_PACKET_DELIVERY_ID,
  ioReturningMemoryLines,
  selectIoRecognitionBeat,
  type IoPacketMemoryOutcome as CanonicalPacketOutcome,
  type IoReturnTone as CanonicalReturnTone,
  type IoRouteAttention as CanonicalRouteAttention,
  type IoSliceMemoryRecord,
} from './io-recognition-beat';

// The memory-lines surface only speaks about the two delivered outcomes and
// the deterministic route/tone axes. `withheld`/`returned` and the `unknown`
// axis values are handled by the canonical selector directly.
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
  completedDeliveryIds?: readonly string[];
  packetOutcome?: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
  returnTone?: IoReturnTone;
}

// Derive a memory line from a canonical beat. The `text` is a direct reference
// to the beat's `line` — if the beat's copy changes, this record inherits it.
function fromRouteBeat(
  id: IoMemoryLineId,
  routeAttention: CanonicalRouteAttention,
  extraFacts: readonly string[] = [],
): IoMemoryLine {
  const beat = selectIoRecognitionBeat({
    completedDeliveryIds: [],
    routeAttention,
  });
  return {
    id,
    text: beat.line,
    rememberedFacts: [...beat.remembers, ...extraFacts],
  };
}

function fromToneBeat(id: IoMemoryLineId, returnTone: CanonicalReturnTone): IoMemoryLine {
  const beat = selectIoRecognitionBeat({
    completedDeliveryIds: [],
    routeAttention: 'unknown',
    returnTone,
  });
  return {
    id,
    text: beat.line,
    rememberedFacts: [...beat.remembers],
  };
}

function fromPacketReturningLine(
  id: IoMemoryLineId,
  key: 'keptSealed' | 'opened',
  facts: readonly string[],
): IoMemoryLine {
  return {
    id,
    text: ioReturningMemoryLines[key].text,
    rememberedFacts: [...facts],
  };
}

export const IO_MEMORY_LINES: Record<IoMemoryLineId, IoMemoryLine> = {
  'io.return.packet.sealed': fromPacketReturningLine('io.return.packet.sealed', 'keptSealed', [
    'io.returned',
    'packet.blueSeal.unbroken',
  ]),
  'io.return.packet.opened': fromPacketReturningLine('io.return.packet.opened', 'opened', [
    'io.returned',
    'packet.blueSeal.opened',
  ]),
  'io.route.skipped': fromRouteBeat('io.route.skipped', 'skipped', ['signBox.found']),
  'io.route.listened': fromRouteBeat('io.route.listened', 'listened'),
  'io.return.tone.kind': fromToneBeat('io.return.tone.kind', 'kind'),
  'io.return.tone.evasive': fromToneBeat('io.return.tone.evasive', 'evasive'),
  'io.return.tone.blunt': fromToneBeat('io.return.tone.blunt', 'blunt'),
};

// Widened packet outcome so callers using the canonical type can still pass
// `withheld`/`returned`; those are handled by the canonical selector and this
// shim skips them (no dedicated memory-lines row).
type AnyPacketOutcome = IoPacketOutcome | CanonicalPacketOutcome;

export function selectIoMemoryLines(state: {
  completedDeliveryIds?: readonly string[];
  packetOutcome?: AnyPacketOutcome;
  routeAttention?: IoRouteAttention;
  returnTone?: IoReturnTone;
}): IoMemoryLine[] {
  const lines: IoMemoryLine[] = [];
  const deliveries = state.completedDeliveryIds ?? [];
  const firstDeliveryDone = deliveries.includes(FIRST_PACKET_DELIVERY_ID);

  // Fresh-session guard: don't surface a packet-return line until the first
  // delivery has actually been recorded. Mirrors `selectIoReturningLine` in
  // io-recognition-beat.ts.
  if (firstDeliveryDone) {
    if (state.packetOutcome === 'sealed') {
      lines.push(IO_MEMORY_LINES['io.return.packet.sealed']);
    }
    if (state.packetOutcome === 'opened') {
      lines.push(IO_MEMORY_LINES['io.return.packet.opened']);
    }
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

// Re-export the canonical types & selectors so downstream code can migrate to
// the source of truth without adding a second import path later.
export {
  FIRST_PACKET_DELIVERY_ID,
  ioReturningMemoryLines,
  selectIoRecognitionBeat,
  type IoSliceMemoryRecord,
} from './io-recognition-beat';
