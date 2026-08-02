// Io memory-audit surface — the shipped consumer of `io-memory-lines.ts`.
//
// Where it runs: after a delivery lands, the slice needs to show the player
// what Io actually remembers about them — packet outcome, route attention,
// return tone — as an ordered, stable list keyed by dot-namespaced ids the
// persistence layer already understands. `selectIoRecognitionBeat` returns
// ONE line for the moment of recognition; the audit surface returns the
// FULL set of remembered facts, one entry per axis the player touched.
//
// This module is the reason `io-memory-lines.ts` exists as a composed-list
// selector rather than folding back into the single-line recognition beat.
//
// Contract:
//   • Input is a canonical `IoSliceMemoryRecord` — same shape the recognition
//     beat consumes, so slice code passes ONE memory object into both.
//   • Wider axes on the canonical record (`withheld` / `returned` packet
//     outcomes, `unknown` route/tone) are silently skipped here; they belong
//     to the recognition selector, not the audit list.
//   • Fresh-session guard is honored via `selectIoMemoryLines`: no packet
//     entry appears until `completedDeliveryIds` records the first delivery.

import {
  IO_MEMORY_LINES,
  selectIoMemoryLines,
  type IoMemoryLineId,
  type IoMemoryLineRecord,
  type IoPacketOutcome,
  type IoReturnTone,
  type IoRouteAttention,
} from './io-memory-lines';
import type { IoSliceMemoryRecord } from './io-recognition-beat';

export type { IoMemoryLineId, IoMemoryLineRecord } from './io-memory-lines';

// Narrow a canonical packet outcome to the shim's two-outcome axis. The
// canonical `withheld` and `returned` states don't have their own audit rows —
// they're spoken about by the recognition beat instead — so we drop them.
function narrowPacketOutcome(outcome: IoSliceMemoryRecord['packetOutcome']): IoPacketOutcome | undefined {
  return outcome === 'sealed' || outcome === 'opened' ? outcome : undefined;
}

function narrowRouteAttention(
  attention: IoSliceMemoryRecord['routeAttention'],
): IoRouteAttention | undefined {
  return attention === 'listened' || attention === 'skipped' ? attention : undefined;
}

function narrowReturnTone(tone: IoSliceMemoryRecord['returnTone']): IoReturnTone | undefined {
  return tone === 'kind' || tone === 'evasive' || tone === 'blunt' ? tone : undefined;
}

/**
 * Build the ordered list of Io memory-line records to display on the slice's
 * memory-audit surface for a given player memory.
 *
 * Order is: packet outcome → route attention → return tone. That mirrors the
 * chronology of the slice: first the player made a packet choice, then they
 * either listened or didn't, then Io read their tone on return.
 */
export function buildIoMemoryAudit(memory: IoSliceMemoryRecord): IoMemoryLineRecord[] {
  return selectIoMemoryLines({
    completedDeliveryIds: memory.completedDeliveryIds,
    packetOutcome: narrowPacketOutcome(memory.packetOutcome),
    routeAttention: narrowRouteAttention(memory.routeAttention),
    returnTone: narrowReturnTone(memory.returnTone),
  });
}

/**
 * Return the ordered list of stable ids for the current memory. The audit UI
 * uses these keys for React lists and analytics events without needing the
 * full text or fact strings.
 */
export function ioMemoryAuditIds(memory: IoSliceMemoryRecord): IoMemoryLineId[] {
  return buildIoMemoryAudit(memory).map((line) => line.id);
}

/**
 * Flatten the audit into the set of remembered facts (deduplicated, order
 * preserved). Persistence writes this set alongside the authored memory
 * sentence so the next session's LLM prompt has the exact strings Io would
 * have said aloud.
 */
export function ioMemoryAuditFacts(memory: IoSliceMemoryRecord): string[] {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const line of buildIoMemoryAudit(memory)) {
    for (const fact of line.rememberedFacts) {
      if (seen.has(fact)) continue;
      seen.add(fact);
      facts.push(fact);
    }
  }
  return facts;
}

// Re-export the record catalog too — the memory-audit UI imports everything it
// needs from this one surface module, not from the shim directly.
export { IO_MEMORY_LINES } from './io-memory-lines';
