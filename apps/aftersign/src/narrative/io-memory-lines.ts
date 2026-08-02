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
//     the memory-audit surface (`io-memory-audit-surface.ts`) uses the list.
//
// The fresh-session guard mirrors `selectIoReturningLine`: no packet memory
// line surfaces until `completedDeliveryIds` records the first delivery.
//
// Type-collision note: `IoMemoryLine` is OWNED by io-recognition-beat.ts and
// re-exported at the bottom of this file. The shim's own record type is
// `IoMemoryLineRecord` (different shape: dot-namespaced id + fact list) so it
// never shadows the canonical one.

import {
  FIRST_PACKET_DELIVERY_ID,
  ioReturningMemoryLines,
  selectIoRecognitionBeat,
  type IoPacketMemoryOutcome as CanonicalPacketOutcome,
  type IoReturnTone as CanonicalReturnTone,
  type IoRouteAttention as CanonicalRouteAttention,
  type IoSliceMemoryRecord,
} from './io-recognition-beat';

// The canonical packet-outcome key each shim packet-line derives from. Route
// and tone helpers call `selectIoRecognitionBeat` directly; packet lines pin
// to the exact PACKET_BEATS row so the shim never invents a fact string.
const PACKET_OUTCOME_BY_RETURNING_KEY = {
  keptSealed: 'sealed',
  opened: 'opened',
} as const satisfies Record<'keptSealed' | 'opened', CanonicalPacketOutcome>;

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

// NOT `IoMemoryLine` — that name is reserved for the canonical
// `IoSliceLine`-extending type in io-recognition-beat.ts (re-exported below).
// This shim's record has a different shape and is deliberately named apart.
export interface IoMemoryLineRecord {
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
): IoMemoryLineRecord {
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

function fromToneBeat(id: IoMemoryLineId, returnTone: CanonicalReturnTone): IoMemoryLineRecord {
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
): IoMemoryLineRecord {
  // Derive facts from the canonical PACKET_BEATS row via the recognition
  // selector — same pattern as fromRouteBeat/fromToneBeat, so the shim's
  // fact vocabulary always matches the words Io actually said.
  const beat = selectIoRecognitionBeat({
    completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
    packetOutcome: PACKET_OUTCOME_BY_RETURNING_KEY[key],
  });
  return {
    id,
    text: ioReturningMemoryLines[key].text,
    rememberedFacts: [...beat.remembers],
  };
}

export const IO_MEMORY_LINES: Record<IoMemoryLineId, IoMemoryLineRecord> = {
  'io.return.packet.sealed': fromPacketReturningLine('io.return.packet.sealed', 'keptSealed'),
  'io.return.packet.opened': fromPacketReturningLine('io.return.packet.opened', 'opened'),
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
}): IoMemoryLineRecord[] {
  const lines: IoMemoryLineRecord[] = [];
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
// the source of truth without adding a second import path later. The canonical
// `IoMemoryLine` type is re-exported here explicitly so nothing in the app
// picks up a colliding shim-local shape.
export {
  FIRST_PACKET_DELIVERY_ID,
  ioReturningMemoryLines,
  selectIoRecognitionBeat,
  type IoMemoryLine,
  type IoSliceMemoryRecord,
} from './io-recognition-beat';
