import { describe, expect, it } from 'vitest';

import {
  ioFirstSessionLines,
  ioMemoryAudit,
  ioMemoryAuditFacts,
  ioMemoryAuditIds,
  ioMemorySentence,
  ioReturningLine,
  type IoSliceMemory,
} from './io-slice-copy';
import { IO_MEMORY_LINES } from './io-memory-lines';

describe('Io slice copy', () => {
  it('keeps first-session packet reactions tied to auditable packet outcomes', () => {
    expect(ioFirstSessionLines.sealedReturn).toMatchObject({
      id: 'io.first.sealedReturn',
      remembers: ['packetOutcome:sealed'],
    });
    expect(ioFirstSessionLines.openedReturn).toMatchObject({
      id: 'io.first.openedReturn',
      remembers: ['packetOutcome:opened'],
    });
  });

  it.each<[IoSliceMemory, string, string[]]>([
    [
      { packetOutcome: 'sealed', returnedAfterClose: true },
      'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
      ['packetOutcome:sealed', 'returnedAfterClose'],
    ],
    [
      { packetOutcome: 'opened', returnedAfterClose: true },
      'You came back. The seal did not. I can use one of those facts.',
      ['packetOutcome:opened', 'returnedAfterClose'],
    ],
    [
      { packetOutcome: 'unknown', routeAttention: 'skipped' },
      'You found the box anyway. Next time, let me finish saving your life.',
      ['routeAttention:skipped'],
    ],
    [
      { packetOutcome: 'unknown', routeAttention: 'listened' },
      'You listened before you ran. Rare habit. Keep it.',
      ['routeAttention:listened'],
    ],
  ])('selects a concrete returning line for %#', (memory, text, remembers) => {
    expect(ioReturningLine(memory)).toMatchObject({ text, remembers });
  });

  it.each<[IoSliceMemory, string]>([
    [
      { packetOutcome: 'sealed' },
      'The courier delivered the blue packet with its seal unbroken.',
    ],
    [
      { packetOutcome: 'opened' },
      'The courier opened the blue packet before delivery.',
    ],
    [
      { packetOutcome: 'unknown' },
      'The courier returned to the Night Post, but the packet outcome is not recorded.',
    ],
  ])('writes one auditable memory sentence for %#', (memory, sentence) => {
    expect(ioMemorySentence(memory)).toBe(sentence);
  });

  it('omits returnedAfterClose from remembers when the input memory does not set it', () => {
    expect(ioReturningLine({ packetOutcome: 'sealed' })).toMatchObject({
      id: 'io.return.packetSealed',
      remembers: ['packetOutcome:sealed'],
    });
    expect(ioReturningLine({ packetOutcome: 'opened' })).toMatchObject({
      id: 'io.return.packetOpened',
      remembers: ['packetOutcome:opened'],
    });
  });

  it('falls back to a return line only when no stronger memory beat is available', () => {
    expect(ioReturningLine({ packetOutcome: 'unknown', returnedAfterClose: true })).toMatchObject({
      id: 'io.return.bare',
      text: 'Back again. Good. The city wastes less time on people who return.',
      remembers: ['returnedAfterClose'],
    });
  });

  it('prioritizes packet outcome over softer behavioral memories', () => {
    expect(
      ioReturningLine({
        packetOutcome: 'opened',
        routeAttention: 'listened',
        returnAnswerTone: 'kind',
      }),
    ).toMatchObject({
      id: 'io.return.packetOpened',
      remembers: ['packetOutcome:opened'],
    });
  });

  describe('ioMemoryAudit — audit-list surface for the slice', () => {
    it('composes packet + route + tone in that order from the slice-shaped memory', () => {
      const audit = ioMemoryAudit({
        packetOutcome: 'sealed',
        routeAttention: 'listened',
        returnAnswerTone: 'kind',
      });

      expect(audit).toEqual([
        IO_MEMORY_LINES['io.return.packet.sealed'],
        IO_MEMORY_LINES['io.route.listened'],
        IO_MEMORY_LINES['io.return.tone.kind'],
      ]);
    });

    it('suppresses the packet entry when packetOutcome is unknown (fresh session)', () => {
      const audit = ioMemoryAudit({ packetOutcome: 'unknown', routeAttention: 'skipped' });
      expect(audit).toEqual([IO_MEMORY_LINES['io.route.skipped']]);
    });

    it('returns an empty audit for a fresh memory with no committed axes', () => {
      expect(ioMemoryAudit({ packetOutcome: 'unknown' })).toEqual([]);
      expect(ioMemoryAuditIds({ packetOutcome: 'unknown' })).toEqual([]);
      expect(ioMemoryAuditFacts({ packetOutcome: 'unknown' })).toEqual([]);
    });

    it('exposes stable dot-namespaced ids for the audit UI', () => {
      expect(
        ioMemoryAuditIds({
          packetOutcome: 'opened',
          routeAttention: 'skipped',
          returnAnswerTone: 'blunt',
        }),
      ).toEqual(['io.return.packet.opened', 'io.route.skipped', 'io.return.tone.blunt']);
    });

    it('flattens remembered facts, deduplicated with first-seen order preserved', () => {
      const facts = ioMemoryAuditFacts({
        packetOutcome: 'sealed',
        routeAttention: 'listened',
        returnAnswerTone: 'kind',
      });

      const returnedCount = facts.filter((fact) => fact === 'the player returned').length;
      expect(returnedCount).toBe(1);
      expect(facts[0]).toBe('the player returned');
      expect(facts).toContain('the player delivered the blue packet unopened');
      expect(facts).toContain('the player listened to Io’s route instructions');
      expect(facts).toContain('the player answered Io kindly');
    });

    it('drops the tone axis when returnAnswerTone is unknown or omitted', () => {
      // Route only, no tone — one entry.
      const routeOnly = ioMemoryAudit({
        packetOutcome: 'unknown',
        routeAttention: 'listened',
        returnAnswerTone: 'unknown',
      });
      expect(routeOnly).toEqual([IO_MEMORY_LINES['io.route.listened']]);

      // Route only, tone omitted — same result.
      const routeOnlyOmitted = ioMemoryAudit({
        packetOutcome: 'unknown',
        routeAttention: 'listened',
      });
      expect(routeOnlyOmitted).toEqual([IO_MEMORY_LINES['io.route.listened']]);
    });
  });
});
