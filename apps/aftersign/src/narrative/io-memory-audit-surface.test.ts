import { describe, expect, it } from 'vitest';

import {
  buildIoMemoryAudit,
  ioMemoryAuditFacts,
  ioMemoryAuditIds,
} from './io-memory-audit-surface';
import { IO_MEMORY_LINES } from './io-memory-lines';
import { FIRST_PACKET_DELIVERY_ID, type IoSliceMemoryRecord } from './io-recognition-beat';

// This suite pins the memory-audit surface — the shipped consumer of
// selectIoMemoryLines/IO_MEMORY_LINES — end-to-end from a canonical
// IoSliceMemoryRecord, so a rename or contract drift in the shim breaks a
// runnable slice test, not just a shim-only test.

const baseMemory = (partial: Partial<IoSliceMemoryRecord> = {}): IoSliceMemoryRecord => ({
  completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
  ...partial,
});

describe('io-memory-audit-surface', () => {
  it('composes packet + route + tone into an ordered audit list', () => {
    const audit = buildIoMemoryAudit(
      baseMemory({ packetOutcome: 'sealed', routeAttention: 'listened', returnTone: 'kind' }),
    );

    expect(audit).toEqual([
      IO_MEMORY_LINES['io.return.packet.sealed'],
      IO_MEMORY_LINES['io.route.listened'],
      IO_MEMORY_LINES['io.return.tone.kind'],
    ]);
  });

  it('suppresses the packet entry until the first delivery is recorded', () => {
    const audit = buildIoMemoryAudit({
      completedDeliveryIds: [],
      packetOutcome: 'sealed',
      routeAttention: 'skipped',
    });

    // Route entry still appears — the fresh-session guard is packet-only.
    expect(audit).toEqual([IO_MEMORY_LINES['io.route.skipped']]);
  });

  it('drops canonical outcomes that have no audit row (withheld/returned/unknown)', () => {
    expect(
      buildIoMemoryAudit(
        baseMemory({ packetOutcome: 'withheld', routeAttention: 'unknown', returnTone: 'unknown' }),
      ),
    ).toEqual([]);

    expect(buildIoMemoryAudit(baseMemory({ packetOutcome: 'returned' }))).toEqual([]);
  });

  it('exposes stable dot-namespaced ids for the audit UI', () => {
    expect(
      ioMemoryAuditIds(
        baseMemory({ packetOutcome: 'opened', routeAttention: 'skipped', returnTone: 'blunt' }),
      ),
    ).toEqual(['io.return.packet.opened', 'io.route.skipped', 'io.return.tone.blunt']);
  });

  it('flattens remembered facts across the audit, order preserved and deduplicated', () => {
    const facts = ioMemoryAuditFacts(
      baseMemory({ packetOutcome: 'sealed', routeAttention: 'listened', returnTone: 'kind' }),
    );

    // 'the player returned' appears in every beat's remembers[] — the audit
    // must surface it once, in first-seen order.
    const returnedCount = facts.filter((fact) => fact === 'the player returned').length;
    expect(returnedCount).toBe(1);
    expect(facts[0]).toBe('the player returned');
    expect(facts).toContain('the player delivered the blue packet unopened');
    expect(facts).toContain('the player listened to Io’s route instructions');
    expect(facts).toContain('the player answered Io kindly');
  });

  it('returns an empty audit for a truly fresh memory', () => {
    expect(buildIoMemoryAudit({ completedDeliveryIds: [] })).toEqual([]);
    expect(ioMemoryAuditIds({ completedDeliveryIds: [] })).toEqual([]);
    expect(ioMemoryAuditFacts({ completedDeliveryIds: [] })).toEqual([]);
  });
});
