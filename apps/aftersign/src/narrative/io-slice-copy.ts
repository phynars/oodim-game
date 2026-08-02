import {
  buildIoMemoryAudit,
  ioMemoryAuditFacts as ioMemoryAuditFactsFromSurface,
  ioMemoryAuditIds as ioMemoryAuditIdsFromSurface,
  type IoMemoryLineId,
  type IoMemoryLineRecord,
} from './io-memory-audit-surface';
import { FIRST_PACKET_DELIVERY_ID, type IoSliceMemoryRecord } from './io-recognition-beat';

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

// Re-export the audit surface's line type + id so downstream slice code
// (memory-audit UI, persistence writer) has a single import point: it takes
// its single spoken line from `ioReturningLine`, its persisted sentence from
// `ioMemorySentence`, and its ordered audit list from `ioMemoryAudit` — all
// from this module.
export type { IoMemoryLineId, IoMemoryLineRecord } from './io-memory-audit-surface';

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

// ---------------------------------------------------------------------------
// Memory-audit surface — the ordered list of remembered lines the slice UI
// renders next to Io's single spoken beat. `ioReturningLine` above owns the
// ONE thing Io says out loud on return; `ioMemoryAudit` below owns the FULL
// audit-list surface (packet + route + tone) the memory-audit panel shows,
// and the persistence layer's remembered-facts writer consumes.
//
// This is the shipped consumer of `./io-memory-audit-surface`: the audit
// surface exports the composed line records, and this module bridges the
// slice's `IoSliceMemory` shape (with `returnAnswerTone`, no
// `completedDeliveryIds`) onto the canonical `IoSliceMemoryRecord` shape the
// surface reads.

function toRecognitionMemoryRecord(memory: IoSliceMemory): IoSliceMemoryRecord {
  // The audit surface's fresh-session guard fires when
  // `completedDeliveryIds` does NOT include the first packet delivery. In
  // the slice's `IoSliceMemory` shape, that state is encoded by
  // `packetOutcome === 'unknown'` — no packet has been delivered yet. Any
  // committed outcome ('sealed' | 'opened') means the first delivery
  // landed, so we mark the delivery id as completed on the record.
  const completedDeliveryIds =
    memory.packetOutcome === 'unknown' ? [] : [FIRST_PACKET_DELIVERY_ID];

  return {
    completedDeliveryIds,
    packetOutcome: memory.packetOutcome === 'unknown' ? undefined : memory.packetOutcome,
    routeAttention: memory.routeAttention,
    returnTone:
      memory.returnAnswerTone && memory.returnAnswerTone !== 'unknown'
        ? memory.returnAnswerTone
        : 'unknown',
  };
}

/**
 * Ordered list of Io memory-line records for the slice's memory-audit panel.
 *
 * Order (packet → route → tone) mirrors slice chronology: first the player
 * made a packet choice, then they listened or didn't, then Io read their
 * tone on return. The audit surface's fresh-session guard is honored: no
 * packet entry surfaces while `packetOutcome === 'unknown'`.
 */
export function ioMemoryAudit(memory: IoSliceMemory): IoMemoryLineRecord[] {
  return buildIoMemoryAudit(toRecognitionMemoryRecord(memory));
}

/**
 * Ordered list of stable dot-namespaced ids for the audit — the keys the
 * memory-audit UI uses for React lists and analytics events without needing
 * the full text or fact strings.
 */
export function ioMemoryAuditIds(memory: IoSliceMemory): IoMemoryLineId[] {
  return ioMemoryAuditIdsFromSurface(toRecognitionMemoryRecord(memory));
}

/**
 * Flattened set of remembered facts across the audit, deduplicated with
 * first-seen order preserved. Persistence writes these alongside
 * `ioMemorySentence` so the next session's LLM prompt has the exact strings
 * Io would have said aloud.
 */
export function ioMemoryAuditFacts(memory: IoSliceMemory): string[] {
  return ioMemoryAuditFactsFromSurface(toRecognitionMemoryRecord(memory));
}
